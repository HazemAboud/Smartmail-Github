import { useEffect, useState } from 'react';
import { Navbar, Nav, Button, Form, FormControl, ListGroup } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [emails, setEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  // Add a class to the body to override global styles from Login.css
  useEffect(() => {
    document.body.classList.add('home-active');

    const params = new URLSearchParams(location.search);
    if (params.get('gmail_connected') === 'true') {
      setIsGmailConnected(true);
      setIsLoading(true);
      fetch('http://127.0.0.1:5000/get_emails', { credentials: 'include' })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message || 'Failed to fetch emails') });
          }
          return response.json();
        })
        .then(data => {
          setEmails(data);
          setIsLoading(false);
          // Clean the URL by removing the query parameter after fetching emails
          window.history.replaceState({}, document.title, "/home");
        })
        .catch(error => {
          setError(error.message);
          setIsLoading(false);
        });
    }

    return () => {
      document.body.classList.remove('home-active');
    };
  }, [location.search]);


  const handleGmailConnect = () => {
    // Redirect to backend endpoint to start OAuth flow
    const params = new URLSearchParams({
      state: Math.random().toString(36).substring(2, 15), // Generate a random state
    });
    window.location.href = `http://127.0.0.1:5000/gmail-connect?${params.toString()}`;
  };

  return (
    <div className="home-container">
      {/* Header / Navbar */}
      <Navbar variant="dark" expand="lg" className="home-header px-3">
          <Navbar.Brand className="fw-bold fs-3">SmartMail</Navbar.Brand>
          <Navbar.Toggle aria-controls="navbarScroll" />
          <Navbar.Collapse id="navbarScroll">
            <Form className="d-flex mx-auto search-form">
              <FormControl
                type="search"
                placeholder="Search mail"
                className="me-2 search-input"
                aria-label="Search"
              />
            </Form>
            <Button variant="link" className="text-light fs-3 p-2 settings-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
              </svg>
            </Button>
          </Navbar.Collapse>
      </Navbar>

      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Sidebar */}
        <div className="sidebar d-none d-md-flex flex-column p-3">
          <Button variant="primary" className="w-100 mb-3" onClick={handleGmailConnect} disabled={isGmailConnected}>
            {isGmailConnected ? 'Gmail Connected' : 'Connect Gmail'}
          </Button>
          <Nav defaultActiveKey="inbox" className="flex-column w-100 sidebar-nav">
            Dynamically generated
          </Nav>
          <div className="logout">
            <Button variant="outline-light" className="w-100" onClick={() => navigate('/login')}>Logout</Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content flex-grow-1 d-flex flex-column min-w-0">
          {/* Toolbar */}
          <div className="p-2 d-flex align-items-center border-bottom border-secondary email-toolbar">
              <Form.Check type="checkbox" className="ms-3 me-3" />
              <Button variant="link" className="text-light p-1 refresh-btn">&#x21bb;</Button>
          </div>
          
          {/* Email List */}
          <div className="flex-grow-1 email-list-container">
            {isLoading && <div className="p-3 text-center text-light">Loading emails...</div>}
            {error && <div className="p-3 text-center text-danger">Error: {error}</div>}
            <ListGroup variant="flush">
              {!isLoading && !error && emails.length > 0 ? (
                emails.map(email => (
                  <ListGroup.Item key={email.id} className="email-item">
                    <div className="d-flex align-items-center">
                      <Form.Check type="checkbox" className="me-3" />
                      <div className="email-sender text-truncate">{email.sender}</div>
                      <div className="email-subject text-truncate">{email.subject}</div>
                      <div className="email-snippet text-muted text-truncate">{email.snippet}</div>
                    </div>
                  </ListGroup.Item>
                ))
              ) : (
                !isLoading && !error && <div className="p-3 text-center text-muted">No emails to display. Have you connected your Gmail account?</div>
              )}
            </ListGroup>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;