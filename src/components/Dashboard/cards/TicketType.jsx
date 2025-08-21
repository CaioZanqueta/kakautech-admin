// src/components/Dashboard/cards/TicketType.jsx

import React, { useState, useEffect } from "react";
import { ApiClient } from "adminjs";
import { Text, H5 } from "@adminjs/design-system";
import { Chart } from "react-google-charts";
import _ from "lodash";
import { Card } from "../styles";

const api = new ApiClient();

// Função para preparar os dados para o gráfico de chamados
const makeChartData = (records) => {
  if (!records || records.length === 0) return [];

  // Estes são os status dos seus chamados (tickets)
  const status = {
    open: "Aberto",
    pending: "Pendente",
    in_progress: "Em Andamento",
    closed: "Fechado",
  };

  const values = _.groupBy(records, (record) => record.params.status);
  const data = _.map(status, (value, key) => [value, values[key]?.length || 0]);

  return [["Status do Chamado", "Quantidade"], ...data];
};

const TicketType = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    (async () => {
      // Buscamos os dados do recurso 'tickets'
      const response = await api.resourceAction({
        resourceId: "tickets",
        actionName: "list",
      });

      setChartData(makeChartData(response.data.records));
      setIsEmpty(response.data.records.length === 0);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <></>;
  }

  return (
    // O card agora aponta para a página de listagem de chamados
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