import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
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
      const res = await api.post("/register", form);

      console.log(res.data);

window.location.href = "/";
    } catch (err) {
      alert("Registration Failed");
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

        <h2 style={styles.heading}>Create Account</h2>

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
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
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
            Register
          </button>
        </form>

       <p style={styles.text}>
  Already have an account?
</p>

<a href="/" style={styles.link}>
  Login
</a>
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
    marginBottom: "5px",
    fontSize: "36px",
  },

  subtitle: {
    color: "#cbd5e1",
    marginBottom: "30px",
  },

  heading: {
    color: "white",
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

export default Register;