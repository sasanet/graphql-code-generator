import {
  ParsedConfig,
  BaseVisitor,
  EnumValuesMap,
  indentMultiline,
  indent,
  getBaseTypeNode,
  buildScalarsFromConfig,
} from '@graphql-codegen/visitor-plugin-common';
import { PhpResolversPluginRawConfig } from './config';
import {
  GraphQLSchema,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  TypeNode,
  Kind,
  isScalarType,
  isInputObjectType,
  isEnumType,
} from 'graphql';
import { PHP_SCALARS, PhpDeclarationBlock, wrapTypeWithModifiers } from '../../common/src';

export interface PhpResolverParsedConfig extends ParsedConfig {
  namespace: string;
  className: string;
  listType: string;
  enumValues: EnumValuesMap;
  classMembersPrefix: string;
  useEmptyCtor: boolean;
}

export class PhpResolversVisitor extends BaseVisitor<PhpResolversPluginRawConfig, PhpResolverParsedConfig> {
  constructor(rawConfig: PhpResolversPluginRawConfig, private _schema: GraphQLSchema, defaultNamespace: string) {
    super(rawConfig, {
      immutableTypes: true,
      enumValues: rawConfig.enumValues || {},
      listType: rawConfig.listType || 'Iterable',
      classMembersPrefix: rawConfig.classMembersPrefix || '',
      namespace: rawConfig.namespace || defaultNamespace,
      scalars: buildScalarsFromConfig(_schema, rawConfig, PHP_SCALARS, 'object'),
      useEmptyCtor: false,
    });
  }

  public getImports(): string {
    const allImports = [];

    return allImports.map(i => `use ${i};`).join('\n') + '\n';
  }

  public getNamespace(): string {
    return `namespace ${this.config.namespace};\n`;
  }

  protected getEnumValue(enumName: string, enumOption: string): string {
    if (
      this.config.enumValues[enumName] &&
      typeof this.config.enumValues[enumName] === 'object' &&
      this.config.enumValues[enumName][enumOption]
    ) {
      return this.config.enumValues[enumName][enumOption];
    }

    return enumOption;
  }

  EnumValueDefinition(node: EnumValueDefinitionNode): (enumName: string) => string {
    return (enumName: string) => {
      return indent(`${this.getEnumValue(enumName, node.name.value)}`);
    };
  }

  EnumTypeDefinition(node: EnumTypeDefinitionNode): string {
    const enumName = this.convertName(node.name);
    const enumValues = node.values
      .map(enumValue => {
        const a = (enumValue as any)(node.name.value);
        // replace reserved word new
        if (a.trim() === 'new') {
          return '_new';
        }
        return `case ${a};`;
      })
      .join('\n');

    const enumCtor = indentMultiline(``, 3);

    const enumBlock = [enumValues, enumCtor].join('\n');

    return new PhpDeclarationBlock()
      .asKind('enum')
      .withComment(node.description)
      .withName(enumName)
      .withBlock(indentMultiline(enumBlock, 3)).string;
  }

  protected resolveInputFieldType(typeNode: TypeNode): {
    baseType: string;
    typeName: string;
    isScalar: boolean;
    isArray: boolean;
    isEnum: boolean;
  } {
    const innerType = getBaseTypeNode(typeNode);
    const schemaType = this._schema.getType(innerType.name.value);
    const isArray =
      typeNode.kind === Kind.LIST_TYPE ||
      (typeNode.kind === Kind.NON_NULL_TYPE && typeNode.type.kind === Kind.LIST_TYPE);
    let result: { baseType: string; typeName: string; isScalar: boolean; isArray: boolean; isEnum: boolean };

    if (isScalarType(schemaType)) {
      if (this.scalars[schemaType.name]) {
        result = {
          baseType: this.scalars[schemaType.name],
          typeName: this.scalars[schemaType.name],
          isScalar: true,
          isEnum: false,
          isArray,
        };
      } else {
        result = { isArray, baseType: 'object', typeName: 'object', isScalar: true, isEnum: false };
      }
    } else if (isInputObjectType(schemaType)) {
      const convertedName = this.convertName(schemaType.name);
      const typeName = convertedName.endsWith('Input') ? convertedName : `${convertedName}Input`;
      result = {
        baseType: typeName,
        typeName,
        isScalar: false,
        isEnum: false,
        isArray,
      };
    } else if (isEnumType(schemaType)) {
      result = {
        isArray,
        baseType: this.convertName(schemaType.name),
        typeName: this.convertName(schemaType.name),
        isScalar: false,
        isEnum: true,
      };
    } else {
      result = { isArray, baseType: 'object', typeName: 'object', isScalar: true, isEnum: false };
    }

    if (result) {
      result.typeName = wrapTypeWithModifiers(result.typeName, typeNode, this.config.listType);
    }

    return result;
  }

  protected buildInputTransfomer(name: string, inputValueArray: ReadonlyArray<InputValueDefinitionNode>): string {
    const ctorAttributes = inputValueArray
      .map(arg => {
        const typeToUse = this.resolveInputFieldType(arg.type);

        return `public readonly ${typeToUse.typeName} $${this.config.classMembersPrefix}${arg.name.value}`;
      })
      .join(',');

    return indentMultiline(`class ${name}\n{\n\tpublic function __construct(${ctorAttributes}) {}\n}`, 0);
  }

  FieldDefinition(node: FieldDefinitionNode): (typeName: string) => string {
    return (typeName: string) => {
      if (node.arguments.length > 0) {
        const transformerName = `${this.convertName(typeName, { useTypesPrefix: true })}${this.convertName(
          node.name.value,
          { useTypesPrefix: false }
        )}Args`;

        return this.buildInputTransfomer(transformerName, node.arguments);
      }

      return null;
    };
  }

  InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode): string {
    const convertedName = this.convertName(node);
    const name = convertedName.endsWith('Input') ? convertedName : `${convertedName}Input`;

    return this.buildInputTransfomer(name, node.fields);
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string {
    const fieldsArguments = node.fields.map(f => (f as any)(node.name.value)).filter(r => r);

    return fieldsArguments.join('\n');
  }
}
