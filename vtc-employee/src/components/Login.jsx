import { useState } from 'react'
import supabase from '../supabaseClient'
import './Login.css' // Optional: styling ke liye

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [message, setMessage] = useState('')

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    })
    
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  // Signup handler
  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({ 
      email: email.trim(), 
      password,
      options: {
        data: {
          role: 'employee' // Default role
        }
      }
    })
    
    if (error) {
      setError(error.message)
    } else {
      setMessage('Registration successful! Please check your email for verification.')
    }
    setLoading(false)
  }

  // Forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    
    if (error) {
      setError(error.message)
    } else {
      setMessage('Password reset instructions sent to your email!')
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>VTC Employee {isSignUp ? 'Sign Up' : isForgotPassword ? 'Reset Password' : 'Login'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={isSignUp ? handleSignUp : isForgotPassword ? handleForgotPassword : handleLogin}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
          
          {!isForgotPassword && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
            />
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="submit-btn"
          >
            {loading ? 'Processing...' : 
             isSignUp ? 'Sign Up' : 
             isForgotPassword ? 'Send Reset Link' : 'Login'}
          </button>
        </form>

        <div className="auth-links">
          {!isSignUp && !isForgotPassword && (
            <>
              <button 
                type="button" 
                className="link-btn"
                onClick={() => setIsForgotPassword(true)}
              >
                Forgot Password?
              </button>
              <button 
                type="button" 
                className="link-btn"
                onClick={() => setIsSignUp(true)}
              >
                Create New Account
              </button>
            </>
          )}
          
          {(isSignUp || isForgotPassword) && (
            <button 
              type="button" 
              className="link-btn"
              onClick={() => {
                setIsSignUp(false)
                setIsForgotPassword(false)
                setError('')
                setMessage('')
              }}
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}