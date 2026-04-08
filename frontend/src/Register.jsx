import { Link, useNavigate } from "react-router-dom";
import { useState } from 'react';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();


  async function handleSubmit(e){
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{12,}$/;
    if(passwordRegex.test(password) === false) {
      setError('Password must contain symbols and numbers');
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i; 
    if(emailRegex.test(email) === false) {
      setError('Invalid email address');
      return;
    }
    setError('');
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: username, pass: password, email: email })
    };
    let response = await fetch('http://127.0.0.1:5000/register', request)
    let data = await response.json()
    if (response.ok) {
      navigate('/home');
    } else {
      setError(data.message);
    }
  };

  return (
    <div className="login">
      <span className="login-title">Register</span>
      <form className="login-form" onSubmit={handleSubmit}>
        <input onChange={(e) => setUsername(e.target.value)} className="login-input" type="text" placeholder="Username" />
        <input onChange={(e) => setEmail(e.target.value)} className="login-input" type="email" placeholder="Email" />
        <input onChange={(e) => setPassword(e.target.value)} className="login-input" type="password" placeholder="Password" />
        <input onChange={(e) => setConfirmPassword(e.target.value)} className="login-input" type="password" placeholder="Confirm Password" />
        {error && <p className="error" style={{ color: 'red' }}>{error}</p>}
        <button className="login-button" type="submit">Register</button>
        <div className="register">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}

export default Register;