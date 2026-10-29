-- Execute como administrador do MySQL. Não apaga dados existentes.
CREATE DATABASE IF NOT EXISTS escola CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE escola;
CREATE TABLE IF NOT EXISTS alunos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    curso VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- As amostras não se repetem quando o script é executado novamente.
INSERT INTO alunos (nome, email, curso)
SELECT 'Ana Souza', 'ana@email.com', 'Administração'
WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE email = 'ana@email.com');
INSERT INTO alunos (nome, email, curso)
SELECT 'Carlos Lima', 'carlos@email.com', 'Sistemas de Informação'
WHERE NOT EXISTS (SELECT 1 FROM alunos WHERE email = 'carlos@email.com');

-- Defina uma senha de laboratório e use a mesma no config.json.
-- Se cruduser já existir, CREATE USER não altera a senha anterior.
CREATE USER IF NOT EXISTS 'cruduser'@'localhost' IDENTIFIED BY 'DEFINA_A_SENHA_DO_USUARIO';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola.alunos TO 'cruduser'@'localhost';
-- Para ajustar a senha de um usuário já existente, execute separadamente:
-- ALTER USER 'cruduser'@'localhost' IDENTIFIED BY 'SUA_SENHA';
