import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { cn } from '../lib/utils';
export { Button } from './ui/button';
import { Button } from './ui/button';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'purple' | 'amber' | 'red';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="loading">
      <Loader2 size={17} className="spin" />
      {label}
    </span>
  );
}
export function Loading() {
  return (
    <div aria-label="Loading page" className="skeleton-grid">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="skeleton" />
      ))}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error-state">
      <AlertCircle size={22} />
      <div>
        <strong>We couldn’t load this data</strong>
        <p>
          {error instanceof Error
            ? error.message
            : 'The service is unavailable.'}
        </p>
      </div>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileText size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('modal', wide && 'modal-wide')}>
        <div className="modal-head">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={description ? '' : 'sr-only'}>
              {description || title}
            </DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Close dialog">
            <X size={20} />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={14} />
    </button>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <Badge
      tone={
        status === 'indexed' ? 'green' : status === 'failed' ? 'red' : 'amber'
      }
    >
      {status === 'indexed' ? (
        <Check size={11} />
      ) : status === 'indexing' ? (
        <Loader2 size={11} className="spin" />
      ) : null}
      {status === 'indexed'
        ? 'Indexed'
        : status === 'indexing'
          ? 'Indexing'
          : status}
    </Badge>
  );
}
export function Crumb({ label }: { label: string }) {
  return (
    <div className="breadcrumb">
      Workspace
      <ChevronRight size={12} />
      <span>{label}</span>
    </div>
  );
}
