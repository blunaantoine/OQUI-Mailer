'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  RefreshCw,
  Trash2,
  ExternalLink,
  Key,
  Shield,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

interface GmailConfig {
  configured: boolean
  callbackDone?: boolean
  message?: string
  fromEmail?: string
  fromName?: string
  error?: string
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

type SetupStep = 'credentials' | 'done'

export default function Home() {
  const [gmailConfig, setGmailConfig] = useState<GmailConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [recipients, setRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [subject, setSubject] = useState('Retour de test utilisateur - OQUI')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<EmailRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Setup state
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [setupStep, setSetupStep] = useState<SetupStep>('credentials')
  const [savingConfig, setSavingConfig] = useState(false)
  const [generatingUrl, setGeneratingUrl] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState("L'équipe OQUI")

  const { toast } = useToast()

  const fetchGmailConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/config')
      const data = await res.json()
      setGmailConfig(data)
      // If callback just completed, open dialog on finalize step
      if (data.callbackDone) {
        setSetupStep('done')
        setSetupDialogOpen(true)
      }
    } catch {
      // silent
    } finally {
      setLoadingConfig(false)
    }
  }, [])

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
    fetchGmailConfig()
    fetchHistory()
  }, [fetchGmailConfig, fetchHistory])

  // Step 1: Start OAuth flow
  const startOAuth = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Requis', description: 'Client ID et Client Secret sont requis', variant: 'destructive' })
      return
    }
    setGeneratingUrl(true)
    try {
      const res = await fetch('/api/gmail/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        // Open auth URL in new tab
        window.open(data.authUrl, '_blank')
        toast({
          title: 'Fenêtre ouverte',
          description: 'Autorisez l\'accès Gmail dans la nouvelle fenêtre, puis revenez ici.',
          duration: 8000,
        })
        setSetupDialogOpen(false)
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setGeneratingUrl(false)
    }
  }

  // Step 2: Finalize after callback
  const finalizeConfig = async () => {
    if (!fromEmail.trim()) {
      toast({ title: 'Requis', description: 'L\'email de l\'expéditeur est requis', variant: 'destructive' })
      return
    }
    setSavingConfig(true)
    try {
      const res = await fetch('/api/gmail/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalize: true,
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim() || "L'équipe OQUI",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Connecté !', description: data.message })
        setSetupDialogOpen(false)
        resetSetup()
        fetchGmailConfig()
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setSavingConfig(false)
    }
  }

  const deleteConfig = async () => {
    try {
      await fetch('/api/gmail/config', { method: 'DELETE' })
      toast({ title: 'Déconnecté' })
      fetchGmailConfig()
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' })
    }
  }

  const resetSetup = () => {
    setSetupStep('credentials')
    setClientId('')
    setClientSecret('')
    setFromEmail('')
    setFromName("L'équipe OQUI")
  }

  const addRecipient = () => {
    const email = newEmail.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) return
    if (!emailRegex.test(email)) {
      toast({ title: 'Email invalide', description: `"${email}" n'est pas valide`, variant: 'destructive' })
      return
    }
    if (recipients.includes(email)) {
      toast({ title: 'Doublon', description: 'Cet email est déjà dans la liste', variant: 'destructive' })
      return
    }
    setRecipients([...recipients, email])
    setNewEmail('')
  }

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email))
  }

  const sendEmails = async () => {
    if (!gmailConfig?.configured) {
      toast({ title: 'Configuration requise', description: 'Connectez d\'abord votre compte Gmail', variant: 'destructive' })
      return
    }
    if (recipients.length === 0) {
      toast({ title: 'Destinataires manquants', description: 'Ajoutez au moins un destinataire', variant: 'destructive' })
      return
    }
    if (!subject.trim()) {
      toast({ title: 'Objet manquant', variant: 'destructive' })
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
        toast({ title: 'Emails envoyés', description: data.message })
        setRecipients([])
        fetchHistory()
      } else {
        toast({ title: 'Erreur', description: data.error || 'Erreur lors de l\'envoi', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
              <p className="text-xs text-muted-foreground hidden sm:block">Envoi d&apos;emails via Gmail API</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loadingConfig ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : gmailConfig?.configured ? (
              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden sm:inline">{gmailConfig.fromEmail}</span>
                <span className="sm:hidden">Connecté</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 gap-1.5">
                <XCircle className="h-3 w-3" />
                Non connecté
              </Badge>
            )}

            <Dialog open={setupDialogOpen} onOpenChange={(open) => { setSetupDialogOpen(open); if (!open) resetSetup() }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { resetSetup(); if (gmailConfig?.callbackDone) setSetupStep('done') }}>
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Configuration</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" style={{ color: '#0b3d2e' }} />
                    Connexion Gmail
                  </DialogTitle>
                  <DialogDescription>
                    {setupStep === 'credentials'
                      ? 'Renseignez vos identifiants Google Cloud pour démarrer.'
                      : 'Finalisez la configuration de votre compte d\'envoi.'}
                  </DialogDescription>
                </DialogHeader>

                {/* Step 1: Credentials */}
                {setupStep === 'credentials' && (
                  <div className="space-y-4 py-2">
                    <Card className="border-blue-100 bg-blue-50/50">
                      <CardContent className="p-4 text-sm space-y-2">
                        <p className="font-medium text-blue-900">Avant de commencer</p>
                        <ol className="list-decimal list-inside space-y-1 text-blue-800 text-xs">
                          <li>Allez sur la <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                          <li>Activez la <strong>Gmail API</strong></li>
                          <li>Créez un <strong>OAuth 2.0 Client ID</strong> (type Desktop app)</li>
                          <li>Ajoutez <code className="bg-blue-100 px-1 rounded text-xs">https://oqui-mailer.vercel.app/api/gmail/callback</code> dans les URI de redirection autorisés</li>
                        </ol>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label htmlFor="client-id">Client ID</Label>
                      <Input
                        id="client-id"
                        placeholder="xxxx.apps.googleusercontent.com"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-secret">Client Secret</Label>
                      <Input
                        id="client-secret"
                        type="password"
                        placeholder="GOCSPX-xxxxx"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={startOAuth}
                      disabled={generatingUrl || !clientId.trim() || !clientSecret.trim()}
                      className="w-full text-white gap-2"
                      style={{ backgroundColor: '#0b3d2e' }}
                    >
                      {generatingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Se connecter avec Google
                    </Button>
                  </div>
                )}

                {/* Step 2: Finalize */}
                {setupStep === 'done' && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-medium text-emerald-900">Compte Google autorisé !</p>
                        <p className="text-xs text-emerald-700">Configurez l&apos;expéditeur et sauvegardez.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="from-name">Nom de l&apos;expéditeur</Label>
                        <Input
                          id="from-name"
                          placeholder="L'équipe OQUI"
                          value={fromName}
                          onChange={(e) => setFromName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="from-email">Email de l&apos;expéditeur</Label>
                        <Input
                          id="from-email"
                          placeholder="contact@oqui.fr"
                          value={fromEmail}
                          onChange={(e) => setFromEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={finalizeConfig}
                      disabled={savingConfig || !fromEmail.trim()}
                      className="w-full text-white gap-2"
                      style={{ backgroundColor: '#0b3d2e' }}
                    >
                      {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Enregistrer et activer
                    </Button>
                  </div>
                )}

                {/* Delete config footer */}
                {gmailConfig?.configured && (
                  <DialogFooter className="mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={deleteConfig}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Déconnecter
                    </Button>
                  </DialogFooter>
                )}
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
            {!loadingConfig && !gmailConfig?.configured && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex items-start sm:items-center gap-3 p-4 flex-col sm:flex-row">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Shield className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Connexion Gmail requise</p>
                    <p className="text-xs text-amber-600">Connectez votre compte Google via l&apos;API Gmail pour envoyer des emails.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSetupDialogOpen(true)}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Connecter
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
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient() } }}
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
                          <Badge key={email} variant="secondary" className="gap-1.5 py-1.5 px-3">
                            <Mail className="h-3 w-3" />
                            {email}
                            <button onClick={() => removeRecipient(email)} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
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
                          <p className="text-xs text-muted-foreground">Modèle OQUI prédéfini via Gmail API</p>
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
                        disabled={sending || !gmailConfig?.configured || recipients.length === 0}
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
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => document.getElementById('preview-card')?.scrollIntoView({ behavior: 'smooth' })}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Preview */}
              <Card className="lg:sticky lg:top-24" id="preview-card">
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
            OQUI Mailer &mdash; Gmail API
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