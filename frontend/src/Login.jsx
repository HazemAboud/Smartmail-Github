import { Link, useNavigate } from "react-router-dom";
import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  async function loginRequest(e) {
    e.preventDefault();

    // Basic client-side validation
    if (!username.trim() || !password.trim()) {
      setError('Username and password cannot be empty.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: username, pass: password })
      };

      const response = await fetch('http://127.0.0.1:5000/login', request);
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      const data = contentType && contentType.includes("application/json") 
        ? await response.json() 
        : {};

      if (response.ok) {
        navigate('/home');
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Server connection failed.');
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <div className="min-vh-100 d-flex align-items-center">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={4}>
            <Card className="shadow-sm border-0 rounded-3">
              <Card.Body className="p-4">
                <h2 className="text-center mb-4 fw-bold text-primary">SmartMail</h2>
                <Form onSubmit={loginRequest}>
                  <Form.Group className="mb-3">
                    <Form.Label>Username</Form.Label>
                    <Form.Control type="text" placeholder="Enter username" onChange={(e) => setUsername(e.target.value)} />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" placeholder="Enter password" onChange={(e) => setPassword(e.target.value)} />
                  </Form.Group>

                  {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

                  <Button variant="primary" type="submit" className="w-100 py-2 mb-3 fw-bold" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>

                  <div className="text-center small text-muted">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-decoration-none fw-bold">
                      Register
                    </Link>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Login;