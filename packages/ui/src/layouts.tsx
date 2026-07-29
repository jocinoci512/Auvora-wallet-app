import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  header,
  sidebar,
  children,
  className,
  ...rest
}: AppShellProps): ReactElement {
  const classes = ['auvora-app-shell', className].filter(Boolean).join(' ');
  const bodyClasses = [
    'auvora-app-shell__body',
    sidebar ? 'auvora-app-shell__body--with-sidebar' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {header}
      <div className={bodyClasses}>
        {sidebar}
        <div className="auvora-app-shell__main">{children}</div>
      </div>
    </div>
  );
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Sidebar({ children, className, ...rest }: SidebarProps): ReactElement {
  const classes = ['auvora-sidebar', className].filter(Boolean).join(' ');
  return (
    <aside className={classes} {...rest}>
      {children}
    </aside>
  );
}

export type ContainerWidth = 'default' | 'wide' | 'narrow' | 'responsive';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: ContainerWidth;
  as?: 'div' | 'main' | 'section';
  children: ReactNode;
}

export function Container({
  width = 'default',
  as: Tag = 'div',
  children,
  className,
  ...rest
}: ContainerProps): ReactElement {
  const widthClass =
    width === 'default'
      ? ''
      : width === 'wide'
        ? 'auvora-container--wide'
        : width === 'narrow'
          ? 'auvora-container--narrow'
          : 'auvora-container--responsive';
  const classes = ['auvora-container', widthClass, className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

export type StackGap = 'sm' | 'md' | 'lg';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: StackGap;
  children: ReactNode;
}

export function Stack({ gap = 'md', children, className, ...rest }: StackProps): ReactElement {
  const classes = ['auvora-stack', `auvora-stack--${gap}`, className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  minWidth?: string;
  children: ReactNode;
}

export function Grid({
  minWidth = '240px',
  children,
  className,
  style,
  ...rest
}: GridProps): ReactElement {
  const classes = ['auvora-grid', className].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      style={{ ['--auvora-grid-min' as string]: minWidth, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface PageProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Page({ children, className, ...rest }: PageProps): ReactElement {
  const classes = ['auvora-page', className].filter(Boolean).join(' ');
  return (
    <main className={classes} {...rest}>
      {children}
    </main>
  );
}
