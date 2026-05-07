import { Navbar, Nav, Button, Form, FormControl, ListGroup, NavDropdown, Spinner } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import Categories from './Categories';

const API = 'http://127.0.0.1:5000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', ...options });
  const contentType = res.headers.get("content-type");
  const data = contentType && contentType.includes("application/json")
    ? await res.json()
    : {};

  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatSender(sender) {
  if (!sender) return '';
  const name = sender.split('<')[0].trim();
  return name.replace(/^["']|["']$/g, '') || sender;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function Home() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/get_emails');
      setEmails(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiFetch('/categories');
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const initEmails = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      await apiFetch('/init_emails');
      setGmailConnected(true);
      await fetchEmails(); // Load the newly fetched emails
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    document.body.classList.add('home-active');

    const initialize = async () => {
      try {
        // 1. Check connection status
        const status = await apiFetch('/gmail/status');
        setGmailConnected(status.connected);

        // 2. Check if we just returned from OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const justConnected = urlParams.get('gmail_connected') === 'true';
        const isPending = sessionStorage.getItem('gmail_pending_init') === 'true';

        if (status.connected && (justConnected || isPending)) {
          sessionStorage.removeItem('gmail_pending_init');
          // Clean URL parameters
          window.history.replaceState({}, document.title, "/home");
          await initEmails();
        } else {
          // If already connected and not a fresh redirect, just get data
          fetchEmails();
        }
      } catch (err) {
        console.error("Initialization failed:", err);
        setGmailConnected(false);
      }
      fetchCategories();
    };

    initialize();
  }, []);

  const handleGmailConnect = () => {
    if (categories.length === 0) {
      alert("Please add at least one category before connecting Gmail.");
      return;
    }
    sessionStorage.setItem('gmail_pending_init', 'true');
    window.location.href = `${API}/gmail-connect`;
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
    navigate('/login');
  };

  const handleResync = async () => {
    if (!gmailConnected) return;
    setIsLoading(true);
    try {
      await apiFetch('/sync_emails', { method: 'POST' });
      await fetchEmails();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoriesChange = async (updatedCategories) => {
    setCategories(updatedCategories);
    try {
      await apiFetch('/update_class', { method: 'POST' });
      fetchEmails();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="home-container">
      <Navbar variant="dark" expand="lg" className="home-header px-3" style={{ backgroundColor: '#11011b' }}>
        <Navbar.Brand className="fw-bold fs-3">SmartMail</Navbar.Brand>
        <Navbar.Toggle aria-controls="navbarScroll" />
        <Navbar.Collapse id="navbarScroll">
          <Form className="d-flex mx-auto search-form" onSubmit={(e) => e.preventDefault()}>
            <FormControl
              type="search"
              placeholder="Search mail"
              className="me-2 search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Form>
          <NavDropdown
            align="end"
            title={
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" className="text-light fs-3 settings-btn">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
              </svg>
            }
            id="settings-dropdown"
          >
            <NavDropdown.Item onClick={() => setShowCategories(true)}>Categories</NavDropdown.Item>
            <NavDropdown.Divider />
            <NavDropdown.Item onClick={handleLogout} className="text-danger">Logout</NavDropdown.Item>
          </NavDropdown>
        </Navbar.Collapse>
      </Navbar>

      <div className="d-flex flex-grow-1 overflow-hidden" style={{ backgroundColor: '#11011b' }}>
        <div className="sidebar d-none d-md-flex flex-column p-3">
          <Button 
            variant="primary" 
            className="w-100 mb-2" 
            onClick={handleGmailConnect} 
            disabled={gmailConnected || categories.length === 0 || isSyncing}
          >
            {isSyncing ? <Spinner size="sm" /> : gmailConnected ? 'Gmail Connected' : 'Connect Gmail'}
          </Button>
          {!gmailConnected && categories.length === 0 && (
            <small className="text-warning mb-3 text-center" style={{ fontSize: '0.7rem' }}>
              Add a category to enable connection
            </small>
          )}
          <Nav activeKey={selectedCategory || "inbox"} className="flex-column w-100 sidebar-nav gap-1">
            <Nav.Link
              eventKey="inbox"
              className="sidebar-nav-link rounded px-3 py-2"
              onClick={() => setSelectedCategory(null)}
              disabled={isSyncing}
            >
              All
            </Nav.Link>
            {categories.map(cat => (
              <Nav.Link
                key={cat.id}
                eventKey={cat.name}
                className="sidebar-nav-link rounded px-3 py-2 text-capitalize"
                onClick={() => setSelectedCategory(cat.name)}
                disabled={isSyncing}
              >
                {cat.name}
              </Nav.Link>
            ))}
          </Nav>
        </div>

        <div className="main-content flex-grow-1 d-flex flex-column min-w-0 overflow-hidden">
          {selectedEmail ? (
            <div className="email-detail-view p-4 flex-grow-1 overflow-auto bg-white text-dark">
              <Button variant="secondary" onClick={() => setSelectedEmail(null)} className="mb-3">
                &larr; Back to Inbox
              </Button>
              <h3 className="mb-2 text-dark fw-bold">{selectedEmail.subject}</h3>
              <h5 className="text-muted mb-2">
                From: <span className="fw-normal">{formatSender(selectedEmail.sender)}</span>
              </h5>
              <p className="text-muted small">
                Date: {new Date(selectedEmail.date).toLocaleString()}
              </p>
              <hr />
              <div
                className="email-body text-dark"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}
              >
                {selectedEmail.email_text}
              </div>
            </div>
          ) : (
            <>
              <div className="p-2 d-flex align-items-center border-bottom border-secondary email-toolbar bg-light">
                <Button variant="link" className="text-dark p-1 refresh-btn" onClick={handleResync} disabled={isLoading || isSyncing}>
                  &#x21bb;
                </Button>
              </div>

              <div className="flex-grow-1 email-list-container overflow-auto bg-light">
                {isSyncing ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 p-5 text-center">
                    <Spinner animation="border" variant="primary" className="mb-3" />
                    <h4 className="text-dark fw-bold">Please wait while we fetch your emails</h4>
                    <p className="text-muted">This may take a few minutes, for the first time only...</p>
                  </div>
                ) : (
                  <>
                    {isLoading && <div className="p-3 text-center text-dark">Updating...</div>}
                    {error && <div className="p-3 text-center text-danger">Error: {error}</div>}
                    {!isLoading && !error && (() => {
                      const filteredEmails = emails.filter(email => {
                        const matchesCategory = !selectedCategory || email.category === selectedCategory;
                        const query = searchQuery.toLowerCase();
                        const matchesSearch = !searchQuery ||
                          (email.subject?.toLowerCase().includes(query)) ||
                          (email.sender?.toLowerCase().includes(query)) ||
                          (email.email_text?.toLowerCase().includes(query));
                        return matchesCategory && matchesSearch;
                      });

                      return filteredEmails.length > 0 ? (
                        <ListGroup variant="flush">
                          {filteredEmails.map((email) => (
                            <ListGroup.Item 
                              key={email.gmail_id} 
                              className="email-item border-bottom py-3 bg-white" 
                              onClick={() => setSelectedEmail(email)} 
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="d-flex align-items-center">
                                <div className="email-sender text-truncate text-dark flex-shrink-0" style={{ width: '200px' }}>
                                    {formatSender(email.sender)}
                                </div>
                                <div className="email-main-content text-truncate flex-grow-1 d-flex ms-3">
                                  <span className="email-subject text-truncate text-dark fw-bold me-2">{email.subject}</span>
                                  <span className="email-snippet text-muted text-truncate small">— {truncateText(email.email_text, 60)}</span>
                                </div>
                                <div className="email-date ms-auto ps-3 text-muted small">
                                  {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      ) : (
                        <div className="p-5 text-center text-muted">
                          {searchQuery ? "No results found for your search." : "No emails in this category."}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Categories
        show={showCategories}
        onHide={() => setShowCategories(false)}
        categories={categories}
        onCategoriesChange={handleCategoriesChange}
      />
    </div>
  );
}

export default Home;