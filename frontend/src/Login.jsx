import { Link, useNavigate } from "react-router-dom";
import { useState } from 'react';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  async function loginRequest(e) {
    e.preventDefault();
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: username, pass: password })
    };
    let response = await fetch('http://127.0.0.1:5000/login', request)
    let data = await response.json()
    if (response.ok) {
      navigate('/home');
    } else {
      setError(data.message);
    }
  }
  return (
    <div className="login">
      <span className="login-title">Login</span>
      <form className="login-form" onSubmit={loginRequest}>
        <input onChange={(e) => setUsername(e.target.value)} className="login-input" type="text" placeholder="Username" />
        <input onChange={(e) => setPassword(e.target.value)} className="login-input" type="password" placeholder="Password" />
        {error && <p className="error" style={{ color: 'red' }}>{error}</p>}
        <button className="login-button" type="submit" >Login</button>
        <div className="register">
          <span>Don't have an account?</span>
          <Link to="/register">Register</Link>
        </div>
      </form>
    </div>
  );
}

export default Login;