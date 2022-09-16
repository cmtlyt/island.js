import fastGlob from 'fast-glob';
import path from 'path';
import { lazyWithPreload } from './lazyWithPreload';

export interface RouteMeta {
  routePath: string;
  basePath: string;
  absolutePath: string;
}

export const addLeadingSlash = (str: string) => {
  return str.startsWith('/') ? str : `/${str}`;
};

export const normalizeRoutePath = (routePath: string) => {
  routePath = routePath.replace(/\.(.*)?$/, '').replace(/index$/, '');
  return addLeadingSlash(routePath);
};

export class RouteService {
  #routeData: RouteMeta[] = [];
  constructor(
    private scanDir: string,
    private extensions: string[] // private root: string
  ) {}

  async init() {
    const files = fastGlob
      .sync(`**/*.{${this.extensions.join(',')}}`, {
        cwd: this.scanDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.*', '**/dist/**']
      })
      .sort();
    files.forEach((file) => this.addRoute(file));
  }

  addRoute(filePath: string) {
    const fileRelativePath = path.relative(this.scanDir, filePath);
    const routePath = normalizeRoutePath(fileRelativePath);
    this.#routeData.push({
      routePath,
      basePath: this.scanDir,
      absolutePath: path.join(this.scanDir, fileRelativePath)
    });
  }

  removeRoute(filePath: string) {
    const fileRelativePath = path.relative(this.scanDir, filePath);
    const routePath = normalizeRoutePath(fileRelativePath);
    this.#routeData = this.#routeData.filter(
      (route) => route.routePath !== routePath
    );
  }

  getRoutes() {
    return this.#routeData;
  }

  generateRoutesCode(ssr?: boolean) {
    return `
${
  ssr
    ? ''
    : `import loadable from '@loadable/component';
import { ComponentType, forwardRef, lazy, useRef } from 'react';
import { jsx } from 'react/jsx-runtime';
${lazyWithPreload.toString()};`
};
import React from 'react';
${this.#routeData
  .map((route, index) => {
    return ssr
      ? `import * as Route${index} from '${route.absolutePath}';`
      : `const Route${index} = lazyWithPreload(() => import('${route.absolutePath}'))`;
  })
  .join('\n')}
export const routes = [
${this.#routeData
  .map((route, index) => {
    // In ssr, we don't need to import component dynamically.
    const preload = ssr ? `() => Route${index}` : `Route${index}.preload`;
    const component = ssr ? `Route${index}.default` : `Route${index}`;
    /**
     * For SSR, example:
     * {
     *   route: '/',
     *   element: React.createElement(Route0),
     *   preload: Route0.preload,
     *   filePath: '/Users/xxx/xxx/index.md'
     * }
     *
     * For client render, example:
     * {
     *   route: '/',
     *   element: React.createElement(Route0.default),
     *   preload: Route0.preload,
     *   filePath: '/Users/xxx/xxx/index.md'
     * }
     */
    return `{ path: '${route.routePath}', element: React.createElement(${component}), filePath: '${route.absolutePath}', preload: ${preload} }`;
  })
  .join(',\n')}
];
`;
  }
}
