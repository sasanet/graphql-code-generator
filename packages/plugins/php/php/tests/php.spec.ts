import '@graphql-codegen/testing';
import { buildSchema } from 'graphql';
import { plugin } from '../src';
import { validatePhp } from '../../common/test/validate-php';
import { mergeOutputs } from '@graphql-codegen/plugin-helpers';

const OUTPUT_FILE = 'php/generated/resolvers.php';

describe('Php', () => {
  const schema = buildSchema(/* GraphQL */ `
    scalar DateTime

    type Query {
      me: User!
      user(id: ID!): User!
      searchUser(searchFields: SearchUser!): [User!]!
      updateUser(input: UpdateUserMetadataInput!): [User!]!
      authorize(roles: [UserRole]): Boolean
    }

    input InputWithArray {
      f: [String]
      g: [SearchUser]
    }

    input SearchUser {
      username: String
      email: String
      name: String
      dateOfBirth: DateTime
      sort: ResultSort
      metadata: MetadataSearch
    }

    input MetadataSearch {
      something: Int
    }

    input UpdateUserInput {
      id: ID!
      username: String
      metadata: UpdateUserMetadataInput
    }

    input UpdateUserMetadataInput {
      something: Int
    }

    input CustomInput {
      id: ID!
    }

    enum ResultSort {
      ASC
      DESC
    }

    interface Node {
      id: ID!
    }

    type User implements Node {
      id: ID!
      username: String!
      email: String!
      name: String
      dateOfBirth: DateTime
      friends(skip: Int, limit: Int): [User!]!
    }

    type Chat implements Node {
      id: ID!
      users: [User!]!
      title: String
    }

    enum UserRole {
      ADMIN
      USER
      EDITOR
    }

    union SearchResult = Chat | User
  `);

  it('Should produce valid Php code', async () => {
    const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

    validatePhp(mergeOutputs([result]));
  });

  describe('Enums', () => {
    it('Should generate basic enums correctly', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`enum UserRole {
        case ADMIN;
        case USER;
        case EDITOR;             
      }`);
    });
  });

  describe('Input Types / Arguments useEmptyCtor default false', () => {
    it('Should generate arguments correctly when using Array', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`class InputWithArrayInput
        {
            public function __construct(public readonly Iterable $f,public readonly Iterable $g) {}
        }`);
    });

    it('Should generate input class per each type with field arguments', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`class UserFriendsArgs
        {
            public function __construct(public readonly int $skip,public readonly int $limit) {}
        }`);
    });

    it('Should omit extra Input suffix from input class name if schema name already includes the "Input" suffix', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`class CustomInput
            {
                public function __construct(public readonly object $id) {}
            }`);
    });

    it('Should generate input class per each query with arguments', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`class QueryUserArgs
            {
                public function __construct(public readonly object $id) {}
            }`);

      expect(result).toBeSimilarStringTo(`class QuerySearchUserArgs
            {
                public function __construct(public readonly SearchUserInput $searchFields) {}
            }`);
    });

    it('Should generate check type for enum', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });
      expect(result).toBeSimilarStringTo(`enum ResultSort {
        case   ASC;
        case   DESC;
        }`);
    });

    it('Should generate input class per each input, also with nested input types', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`class MetadataSearchInput
            {
                public function __construct(public readonly int $something) {}
            }`);

      expect(result).toBeSimilarStringTo(`class SearchUserInput
             {
               public function __construct(public readonly string $username,public readonly string $email,public readonly string $name,public readonly object $dateOfBirth,public readonly ResultSort $sort,public readonly MetadataSearchInput $metadata) {}
             }`);
    });

    it('Should generate nested inputs with out duplicated `Input` suffix', async () => {
      const result = await plugin(schema, [], {}, { outputFile: OUTPUT_FILE });

      expect(result).toBeSimilarStringTo(`class UpdateUserMetadataInput
        {
          public function __construct(public readonly int $something) {}
        }`);

      expect(result).toBeSimilarStringTo(`class UpdateUserInput
        {
          public function __construct(public readonly object $id,public readonly string $username,public readonly UpdateUserMetadataInput $metadata) {}
        }`);
    });
  });
});
