import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { Op } from "sequelize";
import { hasAdminPermission } from "../services/auth.js";
import User from "../models/user.js";
import Group from "../models/group.js";
import OnCallSchedule from "../models/on-call-schedule.js";
import path from "path";

var router = express.Router();
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auth ─────────────────────────────────────────────────────
var isAuthenticatedAdmin = function(req, res, next) {
  if (
    (req.session && req.session.adminUser) ||
    (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.role)
  ) return next();
  return res.status(401).json({ message: "Não autenticado." });
};

var requireAdmin = function(req, res, next) {
  var currentUser = (req.session && req.session.adminUser) || req.user;
  if (!hasAdminPermission(currentUser)) {
    return res.status(403).json({ message: "Acesso negado." });
  }
  return next();
};

// ─── Helper: parse data ───────────────────────────────────────
// IMPORTANTE: projeto 100% pt-BR — datas em texto vêm em DD/MM/YYYY.
// NÃO tentar MM/DD/YYYY (formato americano) primeiro: para dias > 12
// isso estoura o mês (ex.: dia 14 virava "mês 14") e o JS Date rola
// silenciosamente para meses/anos seguintes, criando datas fantasmas
// que não existem na planilha (ex.: 14/03/2026 virava 03/02/2027).
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  var s = String(val).trim();

  // Formato brasileiro: DD/MM/YYYY, com hora opcional HH:mm
  var br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (br) {
    var dia = parseInt(br[1], 10);
    var mes = parseInt(br[2], 10);
    var ano = parseInt(br[3], 10);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    var d = new Date(ano, mes - 1, dia, parseInt(br[4] || 0, 10), parseInt(br[5] || 0, 10));
    return isNaN(d) ? null : d;
  }

  // Formato ISO (ex.: "2026-03-14" vindo de JSON/API)
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    var d2 = new Date(s);
    return isNaN(d2) ? null : d2;
  }

  var d3 = new Date(s);
  return isNaN(d3) ? null : d3;
}

// ─── GET /admin/api/oncall/calendar ──────────────────────────
// Retorna plantões no intervalo start..end para o calendário
router.get("/calendar", isAuthenticatedAdmin, async function(req, res) {
  try {
    var start = req.query.start ? new Date(req.query.start) : new Date();
    var end   = req.query.end   ? new Date(req.query.end)   : new Date(start.getTime() + 30 * 86400000);
    var groupId = req.query.groupId || null;

    var where = {
      endedAt: null,
      [Op.or]: [
        // Plantões que se sobrepoem ao intervalo
        {
          startsAt: { [Op.lte]: end },
          [Op.or]: [
            { endsAt: null },
            { endsAt: { [Op.gte]: start } },
          ],
        },
      ],
    };

    if (groupId) where.groupId = groupId;

    var schedules = await OnCallSchedule.findAll({
      where,
      include: [
        { model: User,  as: "User",  attributes: ["id", "name", "email", "phone"] },
        { model: Group, as: "Group", attributes: ["id", "name", "slug"] },
      ],
      order: [["startsAt", "ASC"], ["nivel", "ASC"]],
    });

    return res.json({ schedules });
  } catch (err) {
    console.error("[oncall] calendar", err);
    return res.status(500).json({ message: "Erro ao buscar calendário." });
  }
});

// ─── GET /admin/api/oncall/modelo ─────────────────────────────
router.get("/modelo", isAuthenticatedAdmin, function(req, res) {
  var file = path.join(__dirname, "..", "public", "modelo-plantonistas.xlsx");
  res.download(file, "modelo-plantonistas.xlsx");
});

// ─── POST /admin/api/oncall/import/custom-preview ─────────────
router.post(
  "/import/custom-preview",
  isAuthenticatedAdmin,
  requireAdmin,
  upload.single("file"),
  async function(req, res) {
    try {
      if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado." });

      var groupId = req.body.groupId;
      if (!groupId) return res.status(400).json({ message: "Selecione o grupo." });

      var group = await Group.findByPk(groupId);
      if (!group) return res.status(404).json({ message: "Grupo não encontrado." });

      var wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);

      // Ler aba CONTATOS
      var contactMap = {};
      var wsContatos = wb.getWorksheet("CONTATOS") ||
        wb.worksheets.find(function(w) { return w.name.toLowerCase().includes("contato"); });
      if (wsContatos) {
        wsContatos.eachRow(function(row) {
          var nome = String(row.getCell(2).value || "").trim();
          var tel  = String(row.getCell(3).value || "").trim();
          if (nome && tel && tel !== "Contatos") contactMap[nome] = tel;
        });
      }

      // Ler aba de escala
      var wsEscala = wb.getWorksheet("ESCALA-2026") ||
        wb.worksheets.find(function(w) { return w.name.toLowerCase().includes("escala"); }) ||
        wb.worksheets[0];

      if (!wsEscala) return res.status(400).json({ message: "Aba de escala não encontrada." });

      var users = await User.findAll({ attributes: ["id", "name", "email", "phone"] });

      // Detectar linha de cabeçalho
      var headerRow = 2;
      wsEscala.eachRow(function(row, rowNum) {
        if (headerRow !== 2) return;
        row.eachCell(function(cell) {
          var v = String(cell.value || "").toLowerCase().trim();
          if (v.includes("primeiro") || v.includes("1°")) headerRow = rowNum;
        });
      });

      // Mapear colunas
      var colInicio = 3, colFim = 4;
      // nivel → col
      var nivelCols = [
        { nivel: 1, label: "1º Nível", col: 5 },
        { nivel: 2, label: "2º Nível", col: 6 },
        { nivel: 3, label: "3º Nível", col: 7 },
      ];

      wsEscala.getRow(headerRow).eachCell(function(cell, col) {
        var v = String(cell.value || "").toLowerCase().trim();
        if ((v.includes("início") || v.includes("inicio") || v === "de") && col < 5) colInicio = col;
        else if ((v.includes("fim") || v.includes("término") || v === "até") && col < 5) colFim = col;
        else if (v.includes("primeiro") || v.includes("1°")) nivelCols[0].col = col;
        else if (v.includes("segundo")  || v.includes("2°")) nivelCols[1].col = col;
        else if (v.includes("terceiro") || v.includes("3°")) nivelCols[2].col = col;
      });

      var entries = [];
      wsEscala.eachRow(function(row, rowNum) {
        if (rowNum <= headerRow) return;

        var startsAtRaw = parseDate(row.getCell(colInicio).value);
        var endsAtRaw   = parseDate(row.getCell(colFim).value);
        if (!startsAtRaw) return;

        // As datas da planilha vêm sem horário (meia-noite) e o servidor roda em UTC,
        // enquanto a equipe/portal opera em horário de Brasília (UTC-3). Sem normalizar
        // aqui, o início "00:00" de uma nova semana era salvo como 00:00 UTC, que ao ser
        // exibido em horário de Brasília cai nas 21:00 do dia ANTERIOR (domingo) — sobrepondo
        // a escala da semana anterior, que ainda cobre o domingo inteiro. Fixamos o início às
        // 00:00 de Brasília (03:00 UTC) e o fim às 23:59 de Brasília (02:59 UTC do dia seguinte).
        var startsAt = new Date(Date.UTC(
          startsAtRaw.getUTCFullYear(), startsAtRaw.getUTCMonth(), startsAtRaw.getUTCDate(), 3, 0
        ));

        nivelCols.forEach(function(nc) {
          var nome = String(row.getCell(nc.col).value || "").trim();
          if (!nome) return;

          var ends = endsAtRaw
            ? new Date(Date.UTC(
                endsAtRaw.getUTCFullYear(), endsAtRaw.getUTCMonth(), endsAtRaw.getUTCDate() + 1, 2, 59
              ))
            : null;

          var telefone = contactMap[nome] || null;

          // Tentar casar com usuário
          var primeiroNome = nome.split(" ")[0].toLowerCase();
          var matchedUser = users.find(function(u) {
            return u.name.toLowerCase() === nome.toLowerCase() ||
              u.name.toLowerCase().startsWith(primeiroNome + " ") ||
              u.name.toLowerCase() === primeiroNome;
          }) || null;

          entries.push({
            rowNum,
            nivel:          nc.nivel,
            nivelLabel:     nc.label,
            nomeNaPlanilha: nome,
            startsAt:       startsAt.toISOString(),
            endsAt:         ends ? ends.toISOString() : null,
            telefone,
            matchedUser: matchedUser ? { id: matchedUser.id, name: matchedUser.name, email: matchedUser.email } : null,
          });
        });
      });

      var unmappedNames = Array.from(new Set(
        entries.filter(function(e) { return !e.matchedUser; }).map(function(e) { return e.nomeNaPlanilha; })
      ));

      // Conflitos ativos
      var now = new Date();
      var activeSchedules = await OnCallSchedule.findAll({
        where: {
          groupId,
          startsAt: { [Op.lte]: now },
          endedAt: null,
          [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }],
        },
        include: [
          { model: User,  as: "User",  attributes: ["id", "name", "email"] },
          { model: Group, as: "Group", attributes: ["id", "name"] },
        ],
      });

      return res.json({
        groupId,
        groupName:    group.name,
        entries,
        unmappedNames,
        users:        users.map(function(u) { return { id: u.id, name: u.name, email: u.email }; }),
        conflicts:    activeSchedules.map(function(s) {
          return {
            id:        s.id,
            userName:  s.User  ? s.User.name  : "",
            userEmail: s.User  ? s.User.email : "",
            groupName: s.Group ? s.Group.name : "",
            startsAt:  s.startsAt,
            endsAt:    s.endsAt,
          };
        }),
        totalEntries: entries.length,
        autoMapped:   entries.filter(function(e) { return e.matchedUser; }).length,
      });
    } catch (err) {
      console.error("[oncall] custom-preview", err);
      return res.status(500).json({ message: "Erro ao processar planilha: " + err.message });
    }
  }
);

// ─── POST /admin/api/oncall/import/custom-confirm ─────────────
router.post(
  "/import/custom-confirm",
  isAuthenticatedAdmin,
  requireAdmin,
  async function(req, res) {
    try {
      var entries     = req.body.entries;
      var endConflicts = req.body.endConflicts;
      var conflictIds  = req.body.conflictIds;
      var groupId      = req.body.groupId;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Nenhum dado para importar." });
      }

      if (endConflicts && Array.isArray(conflictIds) && conflictIds.length > 0) {
        await OnCallSchedule.update(
          { endedAt: new Date() },
          { where: { id: { [Op.in]: conflictIds }, endedAt: null } }
        );
      }

      var valid = entries.filter(function(e) { return e.userId; });
      if (valid.length === 0) {
        return res.status(400).json({ message: "Nenhuma entrada com usuário vinculado." });
      }

      var created = await Promise.all(
        valid.map(function(e) {
          return OnCallSchedule.create({
            groupId:       parseInt(groupId, 10),
            userId:        parseInt(e.userId, 10),
            nivel:         e.nivel || null,
            startsAt:      new Date(e.startsAt),
            endsAt:        e.endsAt ? new Date(e.endsAt) : null,
            phoneOverride: e.telefone || null,
            notes:         e.nivelLabel || null,
          });
        })
      );

      return res.json({
        message: created.length + " plantão(ões) importado(s) com sucesso.",
        count:   created.length,
      });
    } catch (err) {
      console.error("[oncall] custom-confirm", err);
      return res.status(500).json({ message: "Erro ao confirmar: " + err.message });
    }
  }
);

// ─── POST /admin/api/oncall/import/preview ────────────────────
router.post(
  "/import/preview",
  isAuthenticatedAdmin,
  requireAdmin,
  upload.single("file"),
  async function(req, res) {
    try {
      if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado." });

      var wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);
      var ws = wb.getWorksheet(1);
      if (!ws) return res.status(400).json({ message: "Planilha vazia." });

      var headers = {};
      ws.getRow(1).eachCell(function(cell, col) {
        headers[String(cell.value).trim().toLowerCase()] = col;
      });

      var required = ["grupo_slug", "email_usuario", "inicio"];
      for (var i = 0; i < required.length; i++) {
        if (!headers[required[i]]) return res.status(400).json({ message: 'Coluna ausente: "' + required[i] + '"' });
      }

      var groups = await Group.findAll({ attributes: ["id", "name", "slug"] });
      var users  = await User.findAll({ attributes: ["id", "name", "email", "phone"] });
      var groupBySlug = {};
      groups.forEach(function(g) { groupBySlug[g.slug] = g; });
      var userByEmail = {};
      users.forEach(function(u) { userByEmail[u.email.toLowerCase()] = u; });

      var rows = [];
      ws.eachRow(function(row, rowNum) {
        if (rowNum === 1) return;
        var get = function(key) {
          var col = headers[key];
          if (!col) return "";
          var v = row.getCell(col).value;
          return v != null ? String(v).trim() : "";
        };

        var grupoSlug   = get("grupo_slug").toLowerCase();
        var emailRaw    = get("email_usuario").toLowerCase();
        var inicioStr   = get("inicio");
        var fimStr      = get("fim");
        var telefone    = get("telefone");
        var observacoes = get("observacoes");

        if (!grupoSlug && !emailRaw && !inicioStr) return;

        var errors = [];
        var grp  = groupBySlug[grupoSlug];
        if (!grp)  errors.push('Grupo "' + grupoSlug + '" não encontrado');
        var user = userByEmail[emailRaw];
        if (!user) errors.push('Usuário "' + emailRaw + '" não encontrado');

        var parseBR = function(s) {
          var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
          if (!m) return null;
          var d = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
          return isNaN(d) ? null : d;
        };
        var startsAt = parseBR(inicioStr);
        if (!startsAt) errors.push('Data inválida: "' + inicioStr + '"');
        var endsAt = fimStr ? parseBR(fimStr) : null;
        if (fimStr && !endsAt) errors.push('Data fim inválida: "' + fimStr + '"');

        rows.push({
          rowNum, grupoSlug,
          groupId: grp ? grp.id : null, groupName: grp ? grp.name : grupoSlug,
          email: emailRaw, userId: user ? user.id : null, userName: user ? user.name : emailRaw,
          inicioStr, fimStr,
          startsAt: startsAt ? startsAt.toISOString() : null,
          endsAt:   endsAt   ? endsAt.toISOString()   : null,
          telefone, observacoes, errors, valid: errors.length === 0,
        });
      });

      if (rows.length === 0) return res.status(400).json({ message: "Planilha sem dados." });

      var groupIds = Array.from(new Set(rows.filter(function(r) { return r.valid && r.groupId; }).map(function(r) { return r.groupId; })));
      var conflicts = [];
      if (groupIds.length > 0) {
        var now = new Date();
        var active = await OnCallSchedule.findAll({
          where: {
            groupId: { [Op.in]: groupIds },
            startsAt: { [Op.lte]: now }, endedAt: null,
            [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }],
          },
          include: [
            { model: User,  as: "User",  attributes: ["id", "name", "email"] },
            { model: Group, as: "Group", attributes: ["id", "name", "slug"] },
          ],
        });
        conflicts = active.map(function(s) {
          return {
            id: s.id, groupName: s.Group ? s.Group.name : "", groupSlug: s.Group ? s.Group.slug : "",
            userName: s.User ? s.User.name : "", userEmail: s.User ? s.User.email : "",
            startsAt: s.startsAt, endsAt: s.endsAt,
          };
        });
      }

      return res.json({
        rows, conflicts,
        validCount:   rows.filter(function(r) { return r.valid; }).length,
        invalidCount: rows.filter(function(r) { return !r.valid; }).length,
      });
    } catch (err) {
      console.error("[oncall] import/preview", err);
      return res.status(500).json({ message: "Erro: " + err.message });
    }
  }
);

// ─── POST /admin/api/oncall/import/confirm ────────────────────
router.post(
  "/import/confirm",
  isAuthenticatedAdmin,
  requireAdmin,
  async function(req, res) {
    try {
      var rows = req.body.rows;
      var endConflicts = req.body.endConflicts;
      var conflictIds  = req.body.conflictIds;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "Sem dados." });
      var validRows = rows.filter(function(r) { return r.valid; });
      if (validRows.length === 0) return res.status(400).json({ message: "Nenhuma linha válida." });
      if (endConflicts && Array.isArray(conflictIds) && conflictIds.length > 0) {
        await OnCallSchedule.update({ endedAt: new Date() }, { where: { id: { [Op.in]: conflictIds }, endedAt: null } });
      }
      var created = await Promise.all(validRows.map(function(r) {
        return OnCallSchedule.create({
          groupId: r.groupId, userId: r.userId,
          startsAt: new Date(r.startsAt), endsAt: r.endsAt ? new Date(r.endsAt) : null,
          phoneOverride: r.telefone || null, notes: r.observacoes || null,
        });
      }));
      return res.json({ message: created.length + " plantão(ões) importado(s).", count: created.length });
    } catch (err) {
      return res.status(500).json({ message: "Erro: " + err.message });
    }
  }
);

// ─── GET /:groupId ────────────────────────────────────────────
router.get("/:groupId", isAuthenticatedAdmin, async function(req, res) {
  try {
    var groupId = req.params.groupId;
    var active  = req.query.active;
    var where   = { groupId };
    if (active === "true") {
      var now = new Date();
      where.startsAt = { [Op.lte]: now };
      where.endedAt  = null;
      where[Op.or]   = [{ endsAt: null }, { endsAt: { [Op.gt]: now } }];
    }
    var schedules = await OnCallSchedule.findAll({
      where,
      include: [{ model: User, as: "User", attributes: ["id", "name", "email", "phone"] }],
      order: [["startsAt", "DESC"], ["nivel", "ASC"]],
    });
    return res.json({ schedules });
  } catch (err) {
    return res.status(500).json({ message: "Erro." });
  }
});

// ─── POST /:groupId ───────────────────────────────────────────
router.post("/:groupId", isAuthenticatedAdmin, requireAdmin, async function(req, res) {
  try {
    var groupId       = req.params.groupId;
    var userId        = req.body.userId;
    var startsAt      = req.body.startsAt;
    var endsAt        = req.body.endsAt;
    var phoneOverride = req.body.phoneOverride;
    var notes         = req.body.notes;
    var nivel         = req.body.nivel || null;
    if (!userId || !startsAt) return res.status(400).json({ message: "userId e startsAt obrigatórios." });
    var grp  = await Group.findByPk(groupId);
    var user = await User.findByPk(userId);
    if (!grp)  return res.status(404).json({ message: "Grupo não encontrado." });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
    var schedule = await OnCallSchedule.create({
      groupId: parseInt(groupId, 10), userId: parseInt(userId, 10),
      nivel: nivel ? parseInt(nivel, 10) : null,
      startsAt: new Date(startsAt), endsAt: endsAt ? new Date(endsAt) : null,
      phoneOverride: phoneOverride || null, notes: notes || null,
    });
    var full = await OnCallSchedule.findByPk(schedule.id, {
      include: [{ model: User, as: "User", attributes: ["id", "name", "email", "phone"] }],
    });
    return res.status(201).json({ schedule: full });
  } catch (err) {
    return res.status(500).json({ message: "Erro." });
  }
});

// ─── PATCH /:id/end ───────────────────────────────────────────
router.patch("/:id/end", isAuthenticatedAdmin, requireAdmin, async function(req, res) {
  try {
    var schedule = await OnCallSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ message: "Não encontrado." });
    if (schedule.endedAt) return res.status(400).json({ message: "Já encerrado." });
    await schedule.update({ endedAt: new Date() });
    return res.json({ message: "Plantão encerrado." });
  } catch (err) {
    return res.status(500).json({ message: "Erro." });
  }
});

// ─── DELETE /all ────────────────────────────────────────────
// Remove TODOS os registros de plantão (opcionalmente filtrando por groupId).
// Precisa vir ANTES de "/:id" para não ser interpretado como um id.
router.delete("/all", isAuthenticatedAdmin, requireAdmin, async function(req, res) {
  try {
    var where = {};
    if (req.query.groupId) where.groupId = req.query.groupId;
    var count = await OnCallSchedule.destroy({ where: where });
    return res.json({ message: "Plantões removidos.", count: count });
  } catch (err) {
    return res.status(500).json({ message: "Erro." });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────
router.delete("/:id", isAuthenticatedAdmin, requireAdmin, async function(req, res) {
  try {
    var schedule = await OnCallSchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ message: "Não encontrado." });
    await schedule.destroy();
    return res.json({ message: "Removido." });
  } catch (err) {
    return res.status(500).json({ message: "Erro." });
  }
});

export default router;
