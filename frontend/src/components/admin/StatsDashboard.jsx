import React, { useEffect, useState } from "react";
import { Card, Row, Col, Spinner, Alert } from "react-bootstrap";
import { getSystemStats } from "../../services/adminStatsService";

const StatCard = ({ title, value, bg = "light" }) => (
  <Card bg={bg} text={bg === "light" ? "dark" : "white"} className="mb-3">
    <Card.Body>
      <Card.Title className="h6">{title}</Card.Title>
      <Card.Text className="display-6">{value}</Card.Text>
    </Card.Body>
  </Card>
);

const StatsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getSystemStats();
        setStats(data);
      } catch (e) {
        setError("Failed to load statistics.");
      }
    })();
  }, []);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!stats)
    return (
      <div className="text-center my-5">
        <Spinner animation="border" />
      </div>
    );

  return (
    <div className="container py-4">
      <h2 className="mb-4">Library System Overview</h2>
      <Row xs={1} sm={2} md={3} lg={4} className="g-4">
        <Col>
          <StatCard title="Total Books" value={stats.total_books} bg="primary" />
        </Col>
        <Col>
          <StatCard title="Available Books" value={stats.available_books} bg="success" />
        </Col>
        <Col>
          <StatCard title="Borrowed Books" value={stats.borrowed_books} bg="warning" />
        </Col>
        <Col>
          <StatCard title="Overdue Books" value={stats.overdue_books} bg="danger" />
        </Col>
        <Col>
          <StatCard title="Total Borrowings" value={stats.total_borrowings} bg="info" />
        </Col>
        <Col>
          <StatCard title="Active Users" value={stats.active_users} bg="secondary" />
        </Col>
        <Col>
          <StatCard title="Categories" value={stats.total_categories} bg="dark" />
        </Col>
        <Col>
          <StatCard title="Digital Resources" value={stats.total_digital_resources} bg="light" />
        </Col>
      </Row>
    </div>
  );
};

export default StatsDashboard;