import { drizzle } from 'drizzle-orm/mysql2/promise';
import mysql from 'mysql2/promise';
import * as schema from '../drizzle/schema.js';
import { sql, eq } from 'drizzle-orm';

async function executeMigration() {
  let connection;
  let db;
  
  try {
    console.log('[MIGRATION] Iniciando migração de usuários...');
    
    // Parse DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL não configurada');
    }
    
    // Parse connection string
    const urlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!urlMatch) {
      throw new Error(`Formato de DATABASE_URL inválido: ${dbUrl}`);
    }
    
    const [, user, password, host, port, database] = urlMatch;
    
    console.log(`[MIGRATION] Conectando a ${host}:${port}/${database}...`);
    
    // Criar conexão
    connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database,
    });
    
    db = drizzle(connection, { schema, mode: 'default' });
    
    console.log('[MIGRATION] ✅ Conectado ao banco de dados');
    
    // PASSO 1: Criar tabela de auditoria
    console.log('[MIGRATION] Passo 1: Criando tabela de auditoria...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_migration_audit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action VARCHAR(255),
        old_user_id INT,
        new_user_id INT,
        display_name VARCHAR(255),
        notes TEXT
      )
    `);
    
    await connection.execute(`
      INSERT INTO user_migration_audit (action, notes)
      VALUES ('MIGRATION_START', 'Iniciando migração segura de usuários')
    `);
    
    console.log('[MIGRATION] ✅ Tabela de auditoria criada');
    
    // PASSO 2: Extrair usuários únicos
    console.log('[MIGRATION] Passo 2: Extraindo usuários únicos...');
    
    const [uniqueUsers] = await connection.execute(`
      SELECT DISTINCT assignedToName as display_name
      FROM tasks
      WHERE assignedToName IS NOT NULL AND assignedToName != ''
      GROUP BY assignedToName
    `);
    
    console.log(`[MIGRATION] Encontrados ${uniqueUsers.length} usuários únicos`);
    
    // PASSO 3: Criar novos usuários
    console.log('[MIGRATION] Passo 3: Criando novos usuários...');
    
    for (const user of uniqueUsers) {
      const displayName = user.display_name;
      
      // Verificar se usuário já existe
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE displayName = ?',
        [displayName]
      );
      
      if (existing.length === 0) {
        // Criar novo usuário
        const openId = `local_${Math.random().toString(36).substr(2, 9)}`;
        
        await connection.execute(
          `INSERT INTO users (openId, name, displayName, role, createdAt, updatedAt, lastSignedIn)
           VALUES (?, ?, ?, 'user', NOW(), NOW(), NOW())`,
          [openId, displayName, displayName]
        );
        
        // Registrar na auditoria
        const [result] = await connection.execute(
          'SELECT LAST_INSERT_ID() as id'
        );
        
        const newUserId = result[0].id;
        
        await connection.execute(
          `INSERT INTO user_migration_audit (action, old_user_id, new_user_id, display_name, notes)
           VALUES ('USER_CREATED', 1, ?, ?, 'Criado a partir de assignedToName')`,
          [newUserId, displayName]
        );
        
        console.log(`  ✅ Usuário criado: ${displayName} (ID: ${newUserId})`);
      }
    }
    
    // PASSO 4: Atualizar tarefas
    console.log('[MIGRATION] Passo 4: Atualizando tarefas...');
    
    await connection.execute(`
      UPDATE tasks t
      JOIN users u ON u.displayName = t.assignedToName
      SET t.assignedToId = u.id
      WHERE t.assignedToName IS NOT NULL 
        AND t.assignedToName != ''
        AND u.id > 1
    `);
    
    const [updateResult] = await connection.execute(
      'SELECT ROW_COUNT() as count'
    );
    
    console.log(`[MIGRATION] ✅ ${updateResult[0].count} tarefas atualizadas`);
    
    // PASSO 5: Registrar atualizações
    await connection.execute(`
      INSERT INTO user_migration_audit (action, old_user_id, new_user_id, display_name, notes)
      SELECT 
        'TASKS_UPDATED',
        1,
        assignedToId,
        assignedToName,
        CONCAT('Atualizadas tarefas com status: ', GROUP_CONCAT(DISTINCT status))
      FROM tasks
      WHERE assignedToId > 1
      GROUP BY assignedToId, assignedToName
    `);
    
    // PASSO 6: Gerar relatório
    console.log('\n[MIGRATION] === RELATÓRIO DE MIGRAÇÃO ===\n');
    
    const [newUsers] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE id > 1'
    );
    console.log(`✅ Novos usuários criados: ${newUsers[0].count}`);
    
    const [tasks] = await connection.execute(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM tasks
    `);
    console.log(`✅ Total de tarefas: ${tasks[0].total}`);
    console.log(`   - Pendentes: ${tasks[0].pending}`);
    console.log(`   - Concluídas: ${tasks[0].completed}`);
    
    const [messages] = await connection.execute(
      'SELECT COUNT(*) as count FROM messages'
    );
    console.log(`✅ Total de mensagens: ${messages[0].count}`);
    
    const [participants] = await connection.execute(
      'SELECT COUNT(*) as count FROM chatRoomParticipants'
    );
    console.log(`✅ Total de participantes: ${participants[0].count}`);
    
    // PASSO 7: Verificar integridade
    const [unmigrated] = await connection.execute(
      'SELECT COUNT(*) as count FROM tasks WHERE assignedToId = 1 AND assignedToName IS NOT NULL'
    );
    
    if (unmigrated[0].count > 0) {
      console.log(`\n⚠️  AVISO: ${unmigrated[0].count} tarefas ainda têm assignedToId = 1`);
    } else {
      console.log('\n✅ Todas as tarefas foram migradas com sucesso!');
    }
    
    // Finalizar
    await connection.execute(
      `INSERT INTO user_migration_audit (action, notes)
       VALUES ('MIGRATION_COMPLETE', 'Migração concluída com sucesso')`
    );
    
    console.log('\n[MIGRATION] ✅ Migração concluída com sucesso!');
    process.exit(0);
    
  } catch (error) {
    console.error('[MIGRATION] ❌ Erro durante migração:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

executeMigration();
