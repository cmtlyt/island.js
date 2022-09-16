import { ComponentType, forwardRef, lazy, useRef } from 'react';
import { PageModule } from 'shared/types';

export type PreloadableComponent<T extends ComponentType<any>> = T & {
  preload: () => Promise<PageModule<T>>;
};

// Runtime code
// Inspired by https://github.com/ianschmitz/react-lazy-with-preload/blob/master/src/index.ts
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const ReactLazyComponent = lazy(factory);
  let PreloadedComponent: T | undefined;
  let factoryPromise: Promise<PageModule<T>> | undefined;

  const Component = forwardRef(function LazyWithPreload(props, ref) {
    const ComponentToRender = useRef(PreloadedComponent ?? ReactLazyComponent);
    const Element = ComponentToRender.current as React.ComponentPropsWithRef<T>;
    return <Element ref={ref} {...props} />;
  });

  const LazyWithPreload = Component as any as PreloadableComponent<T>;

  LazyWithPreload.preload = () => {
    if (!factoryPromise) {
      factoryPromise = factory().then((mod) => {
        PreloadedComponent = mod.default;
        return mod;
      });
    }

    return factoryPromise;
  };

  return LazyWithPreload;
}
