import { GraphQLSchema } from 'graphql';
import { PluginFunction, Types, getCachedDocumentNodeFromSchema, oldVisit } from '@graphql-codegen/plugin-helpers';
import { PhpResolversVisitor } from './visitor';
import { dirname, normalize } from 'path';
import { buildNamespaceFromPath } from '../../common/src';
import { PhpResolversPluginRawConfig } from './config.js';

export const plugin: PluginFunction<PhpResolversPluginRawConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: PhpResolversPluginRawConfig,
  { outputFile }
): Promise<string> => {
  const relevantPath = dirname(normalize(outputFile));
  const defaultNamespace = buildNamespaceFromPath(relevantPath);
  const visitor = new PhpResolversVisitor(config, schema, defaultNamespace);
  const astNode = getCachedDocumentNodeFromSchema(schema);
  const visitorResult = oldVisit(astNode, { leave: visitor });
  const imports = visitor.getImports();
  const namespace = visitor.getNamespace();
  const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');

  return [namespace, imports, blockContent].join('\n');
};
