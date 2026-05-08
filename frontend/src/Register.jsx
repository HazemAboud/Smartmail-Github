import { Link, useNavigate } from "react-router-dom";
import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e){
    e.preventDefault();
    
    // 1. Logical Validation Order (Matches Form UI)
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    // Updated email regex to support modern long TLDs
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
    if(!emailRegex.test(email)) {
      setError('Invalid email address');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must contain symbols and numbers');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: username, pass: password, email: email })
      };

      const response = await fetch('http://127.0.0.1:5000/register', request);
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      const data = contentType && contentType.includes("application/json") 
        ? await response.json() 
        : {};

      if (response.ok) {
        navigate('/home');
      } else {
        setError(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Server connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={4}>
            <Card className="shadow-sm border-0 rounded-3">
              <Card.Body className="p-4">
                <h2 className="text-center mb-4 fw-bold text-primary">Join SmartMail</h2>
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Username</Form.Label>
                    <Form.Control type="text" placeholder="Enter username" onChange={(e) => setUsername(e.target.value)} />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Email address</Form.Label>
                    <Form.Control type="email" placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" placeholder="Min. 12 characters" onChange={(e) => setPassword(e.target.value)} />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Confirm Password</Form.Label>
                    <Form.Control type="password" placeholder="Repeat password" onChange={(e) => setConfirmPassword(e.target.value)} />
                  </Form.Group>

                  {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

                  <Button variant="primary" type="submit" className="w-100 py-2 mb-3 fw-bold" disabled={isLoading}>
                    {isLoading ? 'Creating Account...' : 'Register'}
                  </Button>

                  <div className="text-center small text-muted">
                    Already have an account?{' '}
                    <Link to="/login" className="text-decoration-none fw-bold">
                      Login
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

export default Register;