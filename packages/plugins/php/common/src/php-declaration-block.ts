import { transformComment, indentMultiline } from '@graphql-codegen/visitor-plugin-common';
import { StringValueNode, NameNode } from 'graphql';
import { stripIndent } from './utils';

export type Access = 'private' | 'public' | 'protected' | '';
export type Kind = 'class' | 'interface' | 'enum';
export type MemberFlags = { final?: boolean; static?: boolean };
export type ClassMember = {
  value: string;
  name: string;
  access: Access;
  type: string;
  annotations: string[];
  flags: MemberFlags;
};
export type ClassMethod = {
  methodAnnotations: string[];
  args: Partial<ClassMember>[];
  implementation: string;
  name: string;
  access: Access;
  returnType: string | null;
  returnTypeAnnotations: string[];
  flags: MemberFlags;
};

export class PhpDeclarationBlock {
  _name: string = null;
  _extendStr: string[] = [];
  _implementsStr: string[] = [];
  _kind: Kind = null;
  _access: Access = '';
  _final = false;
  _static = false;
  _block = null;
  _comment = null;
  _annotations: string[] = [];
  _members: ClassMember[] = [];
  _methods: ClassMethod[] = [];
  _nestedClasses: PhpDeclarationBlock[] = [];

  nestedClass(nstCls: PhpDeclarationBlock): PhpDeclarationBlock {
    this._nestedClasses.push(nstCls);

    return this;
  }

  access(access: Access): PhpDeclarationBlock {
    this._access = access;

    return this;
  }

  asKind(kind: Kind): PhpDeclarationBlock {
    this._kind = kind;

    return this;
  }

  final(): PhpDeclarationBlock {
    this._final = true;

    return this;
  }

  static(): PhpDeclarationBlock {
    this._static = true;

    return this;
  }

  annotate(annotations: string[]): PhpDeclarationBlock {
    this._annotations = annotations;

    return this;
  }

  withComment(comment: string | StringValueNode | null): PhpDeclarationBlock {
    if (comment) {
      this._comment = transformComment(comment, 0);
    }

    return this;
  }

  withBlock(block: string): PhpDeclarationBlock {
    this._block = block;

    return this;
  }

  extends(extendStr: string[]): PhpDeclarationBlock {
    this._extendStr = extendStr;

    return this;
  }

  implements(implementsStr: string[]): PhpDeclarationBlock {
    this._implementsStr = implementsStr;

    return this;
  }

  withName(name: string | NameNode): PhpDeclarationBlock {
    this._name = typeof name === 'object' ? name.value : name;

    return this;
  }

  private printMember(member: Partial<ClassMember>): string {
    const flags = member.flags || {};

    const pieces = [
      member.access,
      flags.static ? 'static' : null,
      flags.final ? 'final' : null,
      ...(member.annotations || []).map(annotation => `@${annotation}`),
      member.type,
      member.name,
    ].filter(f => f);

    return pieces.join(' ') + (member.value ? ` = ${member.value}` : '');
  }

  private printMethod(method: ClassMethod): string {
    const pieces = [
      ...method.methodAnnotations.map(a => `@${a}\n`),
      method.access,
      method.flags.static ? 'static' : null,
      method.flags.final ? 'final' : null,
      ...(method.returnTypeAnnotations || []).map(annotation => `@${annotation}`),
      method.returnType,
      method.name,
    ].filter(f => f);

    const args = method.args.map(arg => this.printMember(arg)).join(', ');

    return `${pieces.join(' ')}(${args}) {
${indentMultiline(method.implementation)}
}`;
  }

  addClassMember(
    name: string,
    type: string,
    value: string,
    typeAnnotations: string[] = [],
    access: Access = null,
    flags: MemberFlags = {}
  ): PhpDeclarationBlock {
    this._members.push({
      name,
      type,
      value,
      annotations: typeAnnotations,
      access,
      flags: {
        final: false,
        static: false,
        ...flags,
      },
    });

    return this;
  }

  addClassMethod(
    name: string,
    returnType: string | null,
    impl: string,
    args: Partial<ClassMember>[] = [],
    returnTypeAnnotations: string[] = [],
    access: Access = null,
    flags: MemberFlags = {},
    methodAnnotations: string[] = []
  ): PhpDeclarationBlock {
    this._methods.push({
      name,
      returnType,
      implementation: impl,
      args,
      returnTypeAnnotations,
      access,
      flags: {
        final: false,
        static: false,
        ...flags,
      },
      methodAnnotations: methodAnnotations || [],
    });

    return this;
  }

  public get string(): string {
    let result = '';

    if (this._kind) {
      let name = '';

      if (this._name) {
        name = this._name;
      }

      let extendStr = '';
      let implementsStr = '';
      let annotatesStr = '';
      const final = this._final ? ' final' : '';
      const isStatic = this._static ? ' static' : '';

      if (this._extendStr.length > 0) {
        extendStr = ` extends ${this._extendStr.join(', ')}`;
      }

      if (this._implementsStr.length > 0) {
        implementsStr = ` implements ${this._implementsStr.join(', ')}`;
      }

      if (this._annotations.length > 0) {
        annotatesStr = this._annotations.map(a => `@${a}`).join('\n') + '\n';
      }

      result += `${annotatesStr}${this._access}${isStatic}${final} ${this._kind} ${name}${extendStr}${implementsStr} `;
    }

    const members = this._members.length
      ? indentMultiline(stripIndent(this._members.map(member => this.printMember(member) + ';').join('\n')))
      : null;
    const methods = this._methods.length
      ? indentMultiline(stripIndent(this._methods.map(method => this.printMethod(method)).join('\n\n')))
      : null;
    const nestedClasses = this._nestedClasses.length
      ? this._nestedClasses.map(c => indentMultiline(c.string)).join('\n\n')
      : null;
    const before = '{';
    const after = '}';
    const block = [before, members, methods, nestedClasses, this._block, after].filter(f => f).join('\n');
    result += block;

    return (this._comment ? this._comment : '') + result + '\n';
  }
}
