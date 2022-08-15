import { GraphQLSchema } from 'graphql';
import { PluginFunction, Types, getCachedDocumentNodeFromSchema, oldVisit } from '@graphql-codegen/plugin-helpers';
import { PhpTypesVisitor } from './visitor';
import { dirname, normalize } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { buildNamespaceFromPath } from '@graphql-codegen/php-common';
import { PhpTypesPluginRawConfig } from './config.js';

export const plugin: PluginFunction<PhpTypesPluginRawConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: PhpTypesPluginRawConfig,
  { outputFile }
): Promise<string> => {
  const relevantPath = dirname(normalize(outputFile));
  const defaultNamespace = buildNamespaceFromPath(relevantPath);
  const visitor = new PhpTypesVisitor(config, schema, defaultNamespace);
  const astNode = getCachedDocumentNodeFromSchema(schema);
  const visitorResult = oldVisit(astNode, { leave: visitor });
  const imports = visitor.getImports();
  const namespace = visitor.getNamespace();
  const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');

  return [namespace, imports, blockContent].join('\n');
};
