import neo4j from 'neo4j-driver';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the same directory or parent
dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URL || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

async function setupConstraints() {
  const session = driver.session();
  try {
    console.log('Applying Neo4j Unique Constraints...');
    
    await session.run('CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.person_id IS UNIQUE');
    console.log('✔ Person ID constraint applied');
    
    await session.run('CREATE CONSTRAINT union_id_unique IF NOT EXISTS FOR (u:Union) REQUIRE u.union_id IS UNIQUE');
    console.log('✔ Union ID constraint applied');
    
    console.log('Database setup completed successfully.');
  } catch (err) {
    console.error('❌ Error applying constraints:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

setupConstraints();
