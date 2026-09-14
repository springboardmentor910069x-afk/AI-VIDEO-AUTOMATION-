import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function Login() {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await api.post("/login", form);

      localStorage.setItem("token", res.data.access_token);

      window.location.href = "/dashboard";
    } catch (err) {
      alert("Login Failed");
      console.log(err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>🎬 ClipMind AI</h1>

        <p style={styles.subtitle}>
          AI Powered Video Transcript & Summarizer
        </p>

        <h2 style={styles.heading}>Login</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            style={styles.input}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            style={styles.input}
          />

          <button type="submit" style={styles.button}>
            Login
          </button>
        </form>

        <p style={styles.text}>
          Don't have an account?
        </p>

        <Link to="/register" style={styles.link}>
          Register
        </Link>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#111827",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "400px",
    background: "#1f2937",
    padding: "40px",
    borderRadius: "15px",
    boxShadow: "0 0 25px rgba(0,0,0,0.4)",
    textAlign: "center",
  },

  logo: {
  color: "#4CAF50",
  fontSize: "50px",
  marginBottom: "15px",
},

 subtitle: {
  color: "#cbd5e1",
  marginTop: "10px",
  marginBottom: "30px",
  fontSize: "16px",
},

  heading: {
  color: "white",
  marginTop: "10px",
  marginBottom: "25px",
},

  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "18px",
    borderRadius: "8px",
    border: "1px solid #555",
    background: "#374151",
    color: "white",
    fontSize: "16px",
    boxSizing: "border-box",
  },

  button: {
    width: "100%",
    padding: "12px",
    background: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  text: {
    color: "#cbd5e1",
    marginTop: "20px",
  },

  link: {
    color: "#4CAF50",
    textDecoration: "none",
    fontWeight: "bold",
  },
};

export default Login;