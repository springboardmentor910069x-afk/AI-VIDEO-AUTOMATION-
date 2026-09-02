CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('creator', 'learner', 'educator', 'admin')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE videos (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  duration DOUBLE PRECISION DEFAULT 0,
  size_bytes INTEGER DEFAULT 0,
  mime_type VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT now()
);

