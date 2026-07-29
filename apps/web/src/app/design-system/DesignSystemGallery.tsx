'use client';

import { useState, type ReactElement } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  ChartFrame,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Label,
  List,
  ListItem,
  Loader,
  PageHeader,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Radio,
  RadioGroup,
  SelectField,
  SimpleTooltip,
  Skeleton,
  Stack,
  StatusBadge,
  SuccessState,
  Switch,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  colorDark,
  colorLight,
  useTheme,
  useToast,
} from '@auvora/ui';

const SWATCHES = [
  'primary',
  'success',
  'warning',
  'error',
  'info',
  'background',
  'surfaceSolid',
  'border',
  'text',
  'textMuted',
] as const;

function tokenHex(mode: 'light' | 'dark', key: (typeof SWATCHES)[number]): string {
  const bag = mode === 'light' ? colorLight : colorDark;
  return String(bag[key as keyof typeof bag] ?? '');
}

export function DesignSystemGallery(): ReactElement {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(false);
  const [switched, setSwitched] = useState(true);
  const [radio, setRadio] = useState('a');
  const [select, setSelect] = useState('eth');

  return (
    <main className="auvora-page">
      <PageHeader
        title="Design System"
        subtitle="Auvora UI foundation — tokens, themes, and components. Use this catalog for visual QA."
        actions={
          <Stack gap="sm">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={() => setTheme('light')}>
                Light
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTheme('dark')}>
                Dark
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTheme('system')}>
                System
              </Button>
            </div>
          </Stack>
        }
      />

      <p className="auvora-type-caption">
        Active preference: <strong>{theme}</strong> · Resolved: <strong>{resolvedTheme}</strong>
      </p>

      <section className="auvora-ds-section" id="tokens">
        <h2>Color tokens ({resolvedTheme})</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
            gap: '0.75rem',
          }}
        >
          {SWATCHES.map((key) => {
            const hex = tokenHex(resolvedTheme, key);
            return (
              <div key={key} className="auvora-ds-swatch">
                <div className="auvora-ds-swatch__chip" style={{ background: hex }} />
                <div className="auvora-ds-swatch__meta">
                  <div>{key}</div>
                  <code>{hex}</code>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="auvora-ds-section" id="actions">
        <h2>Actions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <IconButton label="Add item">+</IconButton>
          <SimpleTooltip content="More information">
            <IconButton label="Info">i</IconButton>
          </SimpleTooltip>
        </div>
      </section>

      <section className="auvora-ds-section" id="forms">
        <h2>Forms</h2>
        <Card>
          <Field label="Email" htmlFor="ds-email" hint="We never share your email.">
            <Input id="ds-email" type="email" placeholder="you@example.com" />
          </Field>
          <Field label="Notes" htmlFor="ds-notes">
            <Textarea id="ds-notes" placeholder="Optional notes" />
          </Field>
          <Field label="Network" htmlFor="ds-network">
            <SelectField
              id="ds-network"
              value={select}
              onValueChange={setSelect}
              options={[
                { value: 'eth', label: 'Ethereum' },
                { value: 'sol', label: 'Solana' },
                { value: 'btc', label: 'Bitcoin' },
              ]}
            />
          </Field>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                id="ds-check"
              />
              <span>Accept terms</span>
            </label>
            <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
              <Switch
                checked={switched}
                onCheckedChange={setSwitched}
                id="ds-switch"
                aria-label="Notifications"
              />
              <span>Notifications</span>
            </label>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Label>Settlement</Label>
            <RadioGroup value={radio} onValueChange={setRadio} aria-label="Settlement">
              <Radio value="a" label="Instant" id="ds-r-a" />
              <Radio value="b" label="Standard" id="ds-r-b" />
            </RadioGroup>
          </div>
        </Card>
      </section>

      <section className="auvora-ds-section" id="feedback">
        <h2>Feedback</h2>
        <Alert tone="info" title="Info">
          Informational message
        </Alert>
        <Alert tone="success" title="Success">
          Operation completed
        </Alert>
        <Alert tone="warn" title="Warning">
          Check this carefully
        </Alert>
        <Alert tone="error" title="Error">
          Something failed
        </Alert>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="error">Error</Badge>
          <StatusBadge status="active" />
          <StatusBadge status="pending" />
          <Loader size="sm" />
        </div>
        <Skeleton rows={3} />
        <EmptyState title="No wallets yet" description="Create a wallet to get started." />
        <SuccessState title="Verified" description="Identity check passed." />
        <ErrorState title="Unavailable" description="Try again later." />
        <Button
          variant="secondary"
          onClick={() =>
            push({ title: 'Saved', description: 'Preferences updated.', tone: 'success' })
          }
        >
          Show toast
        </Button>
      </section>

      <section className="auvora-ds-section" id="overlays">
        <h2>Overlays</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Confirm transfer</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
              <p>Transfer 1.0 ETH to the destination address?</p>
              <DialogActions>
                <Button variant="primary">Confirm</Button>
              </DialogActions>
            </DialogContent>
          </Dialog>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p style={{ margin: 0 }}>Popover content with actions or filters.</p>
            </PopoverContent>
          </Popover>
        </div>
      </section>

      <section className="auvora-ds-section" id="navigation">
        <h2>Navigation</h2>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Design System', current: true },
          ]}
        />
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Tokens</TabsTrigger>
            <TabsTrigger value="three">Components</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Overview panel</TabsContent>
          <TabsContent value="two">Tokens panel</TabsContent>
          <TabsContent value="three">Components panel</TabsContent>
        </Tabs>
        <Pagination page={page} pageCount={5} onPageChange={setPage} />
      </section>

      <section className="auvora-ds-section" id="data">
        <h2>Data display</h2>
        <Card>
          <CardHeader
            title="Team"
            description="Recent collaborators"
            actions={<Avatar name="Auvora Ops" />}
          />
          <List divided>
            <ListItem>Alice · Admin</ListItem>
            <ListItem>Bob · Analyst</ListItem>
            <ListItem>Carol · Reviewer</ListItem>
          </List>
        </Card>
        <div style={{ marginTop: '1rem' }}>
          <Table caption="Sample balances">
            <THead>
              <TR>
                <TH>Asset</TH>
                <TH>Balance</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD>ETH</TD>
                <TD>12.4</TD>
              </TR>
              <TR>
                <TD>USDC</TD>
                <TD>1,200.00</TD>
              </TR>
            </TBody>
          </Table>
        </div>
        <ChartFrame
          title="Volume"
          description="Lightweight metric frame (no chart lib)."
          metrics={[
            { label: '24h volume', value: '$2.4M' },
            { label: 'Active wallets', value: '128' },
          ]}
        />
      </section>
    </main>
  );
}
