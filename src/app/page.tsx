'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Send,
  Settings,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  History,
  Server,
  RefreshCw,
  Trash2,
} from 'lucide-react'

interface SmtpConfig {
  configured: boolean
  host?: string
  port?: number
  user?: string
  fromName?: string
  fromEmail?: string
  secure?: boolean
}

interface EmailRecord {
  id: string
  recipient: string
  subject: string
  status: string
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
}

export default function Home() {
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [recipients, setRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [subject, setSubject] = useState('Retour de test utilisateur - OQUI')
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [history, setHistory] = useState<EmailRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // SMTP form state
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: '587',
    user: '',
    password: '',
    fromName: "L'équipe OQUI",
    fromEmail: '',
    secure: false,
  })
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)

  const { toast } = useToast()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Fetch SMTP config on mount
  const fetchSmtpConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/smtp-config')
      const data = await res.json()
      setSmtpConfig(data)
      if (data.configured) {
        setSmtpForm({
          host: data.host || '',
          port: String(data.port || '587'),
          user: data.user || '',
          password: '',
          fromName: data.fromName || "L'équipe OQUI",
          fromEmail: data.fromEmail || '',
          secure: data.secure ?? false,
        })
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger la configuration SMTP',
        variant: 'destructive',
      })
    } finally {
      setLoadingConfig(false)
    }
  }, [toast])

  // Fetch email history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/email-history?limit=50')
      const data = await res.json()
      setHistory(data.records || [])
    } catch {
      // silent
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchSmtpConfig()
    fetchHistory()
  }, [fetchSmtpConfig, fetchHistory])

  // Add recipient
  const addRecipient = () => {
    const email = newEmail.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) return
    if (!emailRegex.test(email)) {
      toast({
        title: 'Email invalide',
        description: `"${email}" n'est pas une adresse email valide`,
        variant: 'destructive',
      })
      return
    }
    if (recipients.includes(email)) {
      toast({
        title: 'Doublon',
        description: 'Cet email est déjà dans la liste',
        variant: 'destructive',
      })
      return
    }
    setRecipients([...recipients, email])
    setNewEmail('')
  }

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email))
  }

  // Send emails
  const sendEmails = async () => {
    if (!smtpConfig?.configured) {
      toast({
        title: 'Configuration requise',
        description: 'Veuillez d\'abord configurer le serveur SMTP',
        variant: 'destructive',
      })
      return
    }
    if (recipients.length === 0) {
      toast({
        title: 'Destinataires manquants',
        description: 'Ajoutez au moins un destinataire',
        variant: 'destructive',
      })
      return
    }
    if (!subject.trim()) {
      toast({
        title: 'Objet manquant',
        description: 'Veuillez renseigner l\'objet de l\'email',
        variant: 'destructive',
      })
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject: subject.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Emails envoyés',
          description: data.message,
        })
        setRecipients([])
        fetchHistory()
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur lors de l\'envoi',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur réseau',
        description: 'Impossible de contacter le serveur',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  // Save SMTP config
  const saveSmtpConfig = async () => {
    if (!smtpForm.host || !smtpForm.port || !smtpForm.user || !smtpForm.password || !smtpForm.fromEmail) {
      toast({
        title: 'Champs manquants',
        description: 'Tous les champs sont requis',
        variant: 'destructive',
      })
      return
    }

    setSavingSmtp(true)
    try {
      const res = await fetch('/api/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpForm),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Configuration sauvegardée',
          description: data.message,
        })
        setSmtpDialogOpen(false)
        fetchSmtpConfig()
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur de sauvegarde',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur réseau',
        description: 'Impossible de contacter le serveur',
        variant: 'destructive',
      })
    } finally {
      setSavingSmtp(false)
    }
  }

  // Delete SMTP config
  const deleteSmtpConfig = async () => {
    try {
      await fetch('/api/smtp-config', { method: 'DELETE' })
      toast({ title: 'Configuration supprimée' })
      fetchSmtpConfig()
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la configuration',
        variant: 'destructive',
      })
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0b3d2e' }}>
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ color: '#0b3d2e' }}>OQUI Mailer</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Envoi d&apos;emails en masse</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loadingConfig ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : smtpConfig?.configured ? (
              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                SMTP configuré
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 gap-1.5">
                <XCircle className="h-3 w-3" />
                SMTP non configuré
              </Badge>
            )}

            <Dialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Configuration</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Configuration SMTP
                  </DialogTitle>
                  <DialogDescription>
                    Configurez votre serveur SMTP pour envoyer des emails. Les identifiants sont stockés localement.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">Hôte</Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.gmail.com"
                        value={smtpForm.host}
                        onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        placeholder="587"
                        value={smtpForm.port}
                        onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">Identifiant</Label>
                    <Input
                      id="smtp-user"
                      placeholder="votre@email.com"
                      value={smtpForm.user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-password">Mot de passe</Label>
                    <Input
                      id="smtp-password"
                      type="password"
                      placeholder="••••••••"
                      value={smtpForm.password}
                      onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {smtpForm.host?.includes('gmail') && 'Utilisez un mot de passe d\'application Google'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Connexion sécurisée (SSL/TLS)</Label>
                      <p className="text-xs text-muted-foreground">Port 465 = activé, Port 587 = désactivé</p>
                    </div>
                    <Switch
                      checked={smtpForm.secure}
                      onCheckedChange={(checked) => setSmtpForm({ ...smtpForm, secure: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="from-name">Nom de l&apos;expéditeur</Label>
                      <Input
                        id="from-name"
                        placeholder="L'équipe OQUI"
                        value={smtpForm.fromName}
                        onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="from-email">Email de l&apos;expéditeur</Label>
                      <Input
                        id="from-email"
                        placeholder="contact@oqui.fr"
                        value={smtpForm.fromEmail}
                        onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex justify-between">
                  {smtpConfig?.configured && (
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={deleteSmtpConfig}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Supprimer
                    </Button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button variant="outline" onClick={() => setSmtpDialogOpen(false)}>Annuler</Button>
                    <Button onClick={saveSmtpConfig} disabled={savingSmtp} style={{ backgroundColor: '#0b3d2e' }} className="text-white hover:opacity-90">
                      {savingSmtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="compose" className="gap-2">
              <Send className="h-4 w-4" />
              Composer
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historique
              {history.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {history.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-6">
            {/* SMTP Warning */}
            {!loadingConfig && !smtpConfig?.configured && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Settings className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Configuration SMTP requise</p>
                    <p className="text-xs text-amber-600">Configurez votre serveur SMTP avant d&apos;envoyer des emails.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSmtpDialogOpen(true)}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Configurer
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Compose Form */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Destinataires</CardTitle>
                    <CardDescription>Ajoutez les adresses email des destinataires</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="email@exemple.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addRecipient()
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={addRecipient}
                        className="shrink-0"
                        style={{ borderColor: '#0b3d2e', color: '#0b3d2e' }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {recipients.length > 0 && (
                      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                        {recipients.map((email) => (
                          <Badge
                            key={email}
                            variant="secondary"
                            className="gap-1.5 py-1.5 px-3"
                          >
                            <Mail className="h-3 w-3" />
                            {email}
                            <button
                              onClick={() => removeRecipient(email)}
                              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {recipients.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {recipients.length} destinataire{recipients.length > 1 ? 's' : ''}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setRecipients([])} className="text-destructive hover:text-destructive text-xs">
                          Tout supprimer
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Détails de l&apos;email</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Objet</Label>
                      <Input
                        id="subject"
                        placeholder="Objet de l'email"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Modèle d&apos;email</Label>
                      <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
                        <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#0b3d2e' }}>
                          <Mail className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Retour de test utilisateur - OQUI</p>
                          <p className="text-xs text-muted-foreground">Modèle OQUI prédéfini avec CTA</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">Prêt</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={sendEmails}
                        disabled={sending || !smtpConfig?.configured || recipients.length === 0}
                        className="flex-1 text-white gap-2 h-11"
                        style={{ backgroundColor: '#0b3d2e' }}
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {sending ? 'Envoi en cours...' : `Envoyer à ${recipients.length} destinataire${recipients.length > 1 ? 's' : ''}`}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Preview */}
              <Card className="lg:sticky lg:top-24">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">Aperçu de l&apos;email</CardTitle>
                    <CardDescription>Visualisez le rendu de l&apos;email</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1.5">
                    <Eye className="h-3 w-3" />
                    Prévisualisation
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden bg-muted/20" style={{ minHeight: 500 }}>
                    <iframe
                      ref={iframeRef}
                      srcDoc={OQUI_EMAIL_HTML}
                      title="Email Preview"
                      className="w-full border-0"
                      style={{ minHeight: 500, height: '100%' }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Historique des envois</CardTitle>
                  <CardDescription>Consultez l&apos;état de vos envois d&apos;emails</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-2" disabled={loadingHistory}>
                  <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Aucun email envoyé pour le moment</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Les emails envoyés apparaîtront ici</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Destinataire</TableHead>
                          <TableHead className="hidden sm:table-cell">Objet</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-mono text-sm max-w-48 truncate">{record.recipient}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm max-w-48 truncate">{record.subject}</TableCell>
                            <TableCell>
                              {record.status === 'sent' ? (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Envoyé
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Échoué
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {formatDate(record.sentAt || record.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            OQUI Mailer &mdash; Outil d&apos;envoi d&apos;emails
          </p>
          <a
            href="https://oqui.duckdns.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            oqui.duckdns.org
          </a>
        </div>
      </footer>
    </div>
  )
}

// Inline the email template for the iframe preview
const OQUI_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <tr>
                        <td align="center" style="background-color: #0b3d2e;">
                            <img src="https://z-cdn-media.chatglm.cn/files/c0f3e917-4773-46fc-8a83-d7db599025e3.png?auth_key=1883358409-403fd3c8509f48efb0171a21eb61f6fe-0-1e8aa7fdd04512546f62028abb9eb7f9" alt="OQUI Bannière" width="600" style="display: block; width: 100%; max-width: 600px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; color: #333333; font-size: 16px; line-height: 1.6;">
                            <p style="margin: 0 0 20px 0;">Bonjour,</p>
                            <p style="margin: 0 0 20px 0;">Merci pour l'intérêt que vous portez à <strong style="color: #0b3d2e;">OQUI</strong>.</p>
                            <p style="margin: 0 0 20px 0;">La phase de test utilisateur est désormais terminée.
                        Nous vous invitons à partager vos retours afin de nous aider à améliorer la plateforme avant son lancement officiel. Vos impressions, difficultés rencontrées et suggestions sont essentielles pour corriger les derniers détails et offrir une meilleure expérience.</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0faf5; border-left: 4px solid #0b3d2e; border-radius: 4px; margin-bottom: 20px;">
                                <tr>
                                    <td style="padding: 20px; color: #333333; font-size: 15px;">
                                        <strong style="color: #0b3d2e; display: block; margin-bottom: 8px;"> Devenir Partenaire</strong>
                                        En participant à cette évaluation, vous pourrez également manifester votre intérêt pour devenir partenaire d'OQUI. Les partenaires sélectionnés pourront bénéficier, selon leur profil et leur contribution, d'un <strong>compte certifié</strong> ou de l'accès au rôle de <strong>rédacteur</strong> afin de publier des opportunités et des actualités sur la plateforme.
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 30px 0;">Nous vous invitons à remplir le formulaire suivant :</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding-bottom: 40px;">
                            <a href="#" style="background-color: #0b3d2e; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; pointer-events: none;">Je participe au test</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px 40px; color: #333333; font-size: 16px; line-height: 1.6; border-top: 1px solid #eeeeee;">
                            <p style="margin: 20px 0 0 0;">Merci pour votre confiance et votre contribution au développement de OQUI.</p>
                            <p style="margin: 10px 0 0 0;"><strong style="color: #0b3d2e;">L'équipe OQUI</strong></p>
                        </td>
                    </tr>
                </table>
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px;">
                    <tr>
                        <td align="center" style="color: #888888; font-size: 12px;">
                            <a href="https://oqui.duckdns.org" target="_blank" style="color: #888888; text-decoration: underline;">oqui.duckdns.org</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`