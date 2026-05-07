
import { useState, useEffect } from 'react';
import { Button, Form, Modal, ListGroup, Spinner, InputGroup } from 'react-bootstrap';

function Categories({ show, onHide, categories, onCategoriesChange }) {
  const [newCategory, setNewCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draftCategories, setDraftCategories] = useState([]);

  // Reset draft whenever modal opens
  useEffect(() => {
    if (show) {
      setDraftCategories(categories);
    }
  }, [show, categories]);

  const handleAddCategory = (e) => {
    e.preventDefault();
    const names = newCategory.split(',')
      .map(name => name.trim())
      .filter(name => name !== "" && !draftCategories.some(d => d.name === name));
    
    if (names.length === 0) return;

    const newEntries = names.map(name => ({
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID for UI tracking
      name: name
    }));

    setDraftCategories([...draftCategories, ...newEntries]);
    setNewCategory('');
  };

  const handleDeleteCategory = (id) => {
    setDraftCategories(draftCategories.filter(c => c.id !== id));
  };

  const handleOk = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Identify what to delete (items in 'categories' but not in 'draftCategories')
      const toDelete = categories.filter(orig => 
        !draftCategories.some(draft => draft.id === orig.id)
      );

      // 2. Identify what to add (items in 'draftCategories' that have a 'temp-' ID)
      const toAdd = draftCategories.filter(draft => 
        !categories.some(orig => orig.id === draft.id)
      );

      // Commit deletions
      for (const cat of toDelete) {
        await fetch(`http://127.0.0.1:5000/categories/${cat.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
      }

      // Commit additions
      for (const cat of toAdd) {
        await fetch('http://127.0.0.1:5000/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: cat.name })
        });
      }

      // 3. Refresh categories from backend to get permanent IDs
      const response = await fetch('http://127.0.0.1:5000/categories', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to refresh categories');
      const data = await response.json();

      // 4. Update parent state (this triggers re-classification in Home.jsx)
      await onCategoriesChange(data);
      onHide();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      setError(null);
      setNewCategory('');
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={handleCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Manage Categories</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <div className="alert alert-danger">{error}</div>}

        <Form onSubmit={handleAddCategory} className="mb-3">
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="New category name..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={isLoading}
            />
            <Button type="submit" variant="primary" disabled={isLoading}>
              Add Category
            </Button>
          </InputGroup>
        </Form>

        <ListGroup variant="flush" className="border rounded">
          {draftCategories.map(category => (
            <ListGroup.Item key={category.id} className="d-flex justify-content-between align-items-center">
              {category.name}
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => handleDeleteCategory(category.id)}
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                </svg>
              </Button>
            </ListGroup.Item>
          ))}
          {draftCategories.length === 0 && !isLoading && (
            <ListGroup.Item className="text-muted text-center">
              No categories defined yet. Add your first category above.
            </ListGroup.Item>
          )}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleOk} disabled={isLoading}>
          {isLoading ? <Spinner animation="border" size="sm" /> : 'Apply'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default Categories;
