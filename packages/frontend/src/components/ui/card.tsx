import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({ className, ...props }) => {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ className, ...props }) => {
  return (
    <h3
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
};

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription: React.FC<CardDescriptionProps> = ({ className, ...props }) => {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({ className, ...props }) => {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter: React.FC<CardFooterProps> = ({ className, ...props }) => {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
};
