import React, { useState } from "react";
// A importação do 'useRecord' foi removida pois não será mais usada
import { useNotice, useCurrentAdmin } from "adminjs";
import {
  Box,
  H2,
  Label,
  Text,
  Badge,
  Button,
  Icon,
} from "@adminjs/design-system";
import TicketComments from "./TicketComments";
import AttachmentComponent from "./AttachmentComponent";
import axios from "axios";

const statusTranslations = {
  open: "Aberto",
  pending: "Pendente",
  in_progress: "Em Andamento",
  closed: "Fechado",
};
const statusVariants = {
  open: "info",
  pending: "primary",
  in_progress: "warning",
  closed: "success",
};
const PropertyInView = ({ label, children }) => (
  <Box display="flex" alignItems="center" mb="lg">
    <Text width="140px" flexShrink={0} variant="sm" color="grey60">
      {label.toUpperCase()}
    </Text>
    <Box>{children}</Box>
  </Box>
);
const AssignToMeButton = ({ record }) => {
  const [loading, setLoading] = useState(false);
  const addNotice = useNotice();
  const handleClick = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/tickets/${record.id}/assign`);
      addNotice({
        message: "Chamado atribuído com sucesso! A página será atualizada.",
        type: "success",
      });
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      const message = error.response?.data?.message || "Ocorreu um erro.";
      addNotice({ message, type: "error" });
      setLoading(false);
    }
  };
  return (
    <Button onClick={handleClick} disabled={loading} variant="primary">
      <Icon icon="UserPlus" />
      {loading ? "A Atribuir..." : "Atribuir a Mim"}
    </Button>
  );
};

const TicketShow = (props) => {
  // === A CORREÇÃO ESTÁ AQUI ===
  // Em vez de usar o 'useRecord', pegamos o 'record' diretamente das props.
  const { record } = props;
  const [currentAdmin] = useCurrentAdmin();

  // A verificação de 'loading' foi removida pois já não é necessária
  if (!record) {
    return <Box>Carregando...</Box>;
  }

  const status = record.params.status;
  const showAssignButton =
    currentAdmin && record.params.userId !== currentAdmin.id;

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="xl"
      >
        <H2>
          Chamado #{record.params.id}: {record.params.title}
        </H2>
        {showAssignButton && <AssignToMeButton record={record} />}
      </Box>

      <Box>
        <Box variant="white" boxShadow="card" p="lg">
          <PropertyInView label="Cliente">
            <Text>{record.populated.clientId?.title || "-"}</Text>
          </PropertyInView>
          <PropertyInView label="Projeto">
            <Text>{record.populated.projectId?.title || "-"}</Text>
          </PropertyInView>
          <PropertyInView label="Responsável">
            <Text>{record.populated.userId?.title || "-"}</Text>
          </PropertyInView>
          <PropertyInView label="Status">
            <Badge variant={statusVariants[status] || "default"}>
              {statusTranslations[status] || status}
            </Badge>
          </PropertyInView>

          <Box mt="xl" pt="xl" borderTop="1px solid #e8e8e8">
            <Label
              style={{
                textTransform: "uppercase",
                fontSize: "12px",
                color: "#888",
              }}
            >
              Descrição
            </Label>
            <Text
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                marginTop: "8px",
              }}
            >
              {record.params.description}
            </Text>
          </Box>

          {record.params.filename && (
            <Box mt="xl" pt="xl" borderTop="1px solid #e8e8e8">
              <AttachmentComponent record={record} />
            </Box>
          )}
        </Box>

        <Box variant="white" boxShadow="card" p="lg" mt="lg">
          <TicketComments {...props} record={record} />
        </Box>
      </Box>
    </Box>
  );
};

export default TicketShow;
