import { Injectable, OnModuleDestroy, OnModuleInit, Module } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Injectable()
export class GraphService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('NEO4J_HOST', 'localhost');
    const port = this.configService.get<number>('NEO4J_PORT', 7687);
    const user = this.configService.get<string>('NEO4J_USER', 'neo4j');
    const pass = this.configService.get<string>('NEO4J_PASSWORD', 'password');
    
    this.driver = neo4j.driver(
      `bolt://${host}:${port}`,
      neo4j.auth.basic(user, pass)
    );
  }

  async onModuleDestroy() {
    await this.driver.close();
  }

  getSession(): Session {
    return this.driver.session();
  }

  async runQuery<T = any>(query: string, params: Record<string, any> = {}): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result.records.map(record => record.toObject()) as T[];
    } finally {
      await session.close();
    }
  }
}

@Module({
  imports: [ConfigModule],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
