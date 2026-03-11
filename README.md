# Dooka – Circle of Life Engine

**Circle of Life** is the core family tree engine for the Dooka memorial platform. It implements a global human graph using a split-identity model to ensure data integrity and prevent duplicates.

## Features
*   **Split Identity Model**: Separates physical persons from user-submitted identity records.
*   **Validation Engine**: Enforces genealogical rules (e.g., max 2 parents, age sanity, no circularity).
*   **Matching Engine**: Multi-dimensional similarity scoring for duplicate detection.
*   **Merge Engine**: Transactional merging of nodes and relationships.
*   **Graph Visualization**: Interactive family trees built with React Flow.

## Tech Stack
*   **Backend**: NestJS (Node.js), TypeScript, Neo4j
*   **Frontend**: React, TypeScript, React Flow, Framer Motion
*   **Database**: Neo4j Graph Database

## Getting Started

### 1. Database Setup (Neo4j)
1.  Install [Neo4j Desktop](https://neo4j.com/download/) or run via Docker:
    ```bash
    docker run -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j
    ```
2.  Create indices for performance:
    ```cypher
    CREATE CONSTRAINT FOR (p:Person) REQUIRE p.person_id IS UNIQUE;
    CREATE INDEX FOR (p:Person) ON (p.name);
    ```

### 2. Backend Setup
```bash
cd backend
npm install
npm run start:dev
```
*Port: 3000*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Port: 5173 (usually)*

## API Endpoints
*   `POST /circle/person`: Create a new person.
*   `POST /circle/relationship`: Add family ties.
*   `GET /circle/tree/:person_id`: Fetch expansive family tree.
*   `GET /circle/match-candidates/:person_id`: Find potential duplicates.
*   `POST /circle/merge`: Merge two confirmed identical persons.

## Validation Rules
1.  **Parent Limit**: Max 2 parents per node.
2.  **Chronology**: Parent must be older than the child.
3.  **Circularity**: Prevents a child from becoming their own ancestor.
4.  **Privacy**: Living persons are private by default; memorial persons are public.
