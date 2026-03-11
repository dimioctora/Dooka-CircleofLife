import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphModule } from './modules/graph/graph.module';
import { PersonModule } from './modules/person/person.module';
import { IdentityModule } from './modules/identity/identity.module';
import { RelationshipModule } from './modules/relationship/relationship.module';
import { MatchingModule } from './modules/matching/matching.module';
import { MergeModule } from './modules/merge/merge.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { CircleOfLifeModule } from './modules/circle-of-life/circle-of-life.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphModule,
    PersonModule,
    IdentityModule,
    RelationshipModule,
    MatchingModule,
    MergeModule,
    PrivacyModule,
    CircleOfLifeModule
  ],
})
export class AppModule {}
