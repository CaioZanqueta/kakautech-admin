import React, { useState, useEffect } from "react";
import { ApiClient } from "adminjs";
import { Text, H5 } from "@adminjs/design-system";
import { Chart } from "react-google-charts";
import _ from "lodash";
import { Card } from "../styles";

const api = new ApiClient();

const makeChartData = (records) => {
  if (!records || records.length === 0) return [];

  const status = {
    open: "Aberto",
    pending: "Pendente",
    in_progress: "Em Andamento",
    closed: "Fechado",
  };

  const values = _.groupBy(records, (record) => record.params.status);
  const data = _.map(status, (value, key) => [value, values[key]?.length || 0]);

  // Filtra os status que não têm nenhum chamado para não poluir o gráfico
  const filteredData = data.filter(item => item[1] > 0);

  return [["Status do Chamado", "Quantidade"], ...filteredData];
};

const TicketType = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    (async () => {
      // ===== INÍCIO DA CORREÇÃO =====
      const response = await api.resourceAction({
        resourceId: "tickets",
        actionName: "list",
        params: {
          perPage: 1000, // Busca até 1000 chamados para garantir que todos são contados
        },
      });
      // ===== FIM DA CORREÇÃO =====

      setChartData(makeChartData(response.data.records));
      setIsEmpty(response.data.records.length === 0);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <></>;
  }

  return (
    <Card as="a" href="/admin/resources/tickets">
      <Text textAlign="center">
        <H5 mt="lg">Chamados de Clientes</H5>
        {isEmpty ? (
          <Text>Sem chamados</Text>
        ) : (
          <Chart
            chartType="PieChart"
            data={chartData}
            width={"100%"}
            height={"100%"}
            options={{
              pieSliceText: 'value',
              pieHole: 0.4,
            }}
          />
        )}
      </Text>
    </Card>
  );
};

export default TicketType;