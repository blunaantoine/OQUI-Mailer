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
  Mail, Send, Settings, Plus, X, CheckCircle2, XCircle,
  Loader2, Eye, History, RefreshCw, Trash2, ExternalLink,
  Shield, Copy, Check,
} from 'lucide-react'

interface GmailCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
  fromName: string
  fromEmail: string
}

interface SendResult {
  email: string
  status: string
  error?: string
}

interface HistoryEntry {
  id: string
  recipient: string
  subject: string
  status: string
  error?: string
  date: string
}

type Step = 'credentials' | 'code' | 'done'

export default function Home() {
  const [creds, setCreds] = useState<GmailCredentials | null>(null)
  const [recipients, setRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [subject, setSubject] = useState('Retour de test utilisateur - OQUI')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const { toast } = useToast()

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<Step>('credentials')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [fromName, setFromName] = useState("L'équipe OQUI")
  const [fromEmail, setFromEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('oqui-gmail-creds')
    if (saved) {
      try { setCreds(JSON.parse(saved)) } catch { /* ignore */ }
    }
    const hist = localStorage.getItem('oqui-history')
    if (hist) {
      try { setHistory(JSON.parse(hist)) } catch { /* ignore */ }
    }
  }, [])

  const saveHistory = (entries: HistoryEntry[]) => {
    setHistory(entries)
    localStorage.setItem('oqui-history', JSON.stringify(entries.slice(0, 200)))
  }

  // Generate auth URL
  const generateUrl = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Requis', description: 'Client ID et Client Secret sont requis', variant: 'destructive' })
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/gmail/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        window.open(data.authUrl, '_blank')
        setStep('code')
        toast({ title: 'Fenêtre ouverte', description: 'Autorisez Gmail, puis copiez le code affiché.', duration: 8000 })
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // Exchange code for token
  const exchangeCode = async () => {
    if (!authCode.trim()) {
      toast({ title: 'Requis', description: 'Collez le code d\'autorisation', variant: 'destructive' })
      return
    }
    setExchanging(true)
    try {
      const res = await fetch('/api/gmail/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          code: authCode.trim(),
          redirectUri: 'https://oqui-mailer.vercel.app/api/gmail/callback',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('oqui-gmail-client-id', clientId.trim())
        localStorage.setItem('oqui-gmail-client-secret', clientSecret.trim())
        localStorage.setItem('oqui-gmail-refresh-token', data.refreshToken)
        setStep('done')
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setExchanging(false)
    }
  }

  // Finalize
  const finalize = () => {
    if (!fromEmail.trim()) {
      toast({ title: 'Requis', description: 'L\'email d\'expéditeur est requis', variant: 'destructive' })
      return
    }
    const newCreds: GmailCredentials = {
      clientId: localStorage.getItem('oqui-gmail-client-id') || clientId.trim(),
      clientSecret: localStorage.getItem('oqui-gmail-client-secret') || clientSecret.trim(),
      refreshToken: localStorage.getItem('oqui-gmail-refresh-token') || '',
      fromName: fromName.trim() || "L'équipe OQUI",
      fromEmail: fromEmail.trim(),
    }
    localStorage.setItem('oqui-gmail-creds', JSON.stringify(newCreds))
    // Clean up temp keys
    localStorage.removeItem('oqui-gmail-client-id')
    localStorage.removeItem('oqui-gmail-client-secret')
    localStorage.removeItem('oqui-gmail-refresh-token')
    setCreds(newCreds)
    setDialogOpen(false)
    resetSetup()
    toast({ title: 'Connecté !', description: 'Votre compte Gmail est configuré.' })
  }

  const disconnect = () => {
    localStorage.removeItem('oqui-gmail-creds')
    setCreds(null)
    toast({ title: 'Déconnecté' })
  }

  const resetSetup = () => {
    setStep('credentials')
    setClientId(creds?.clientId || '')
    setClientSecret(creds?.clientSecret || '')
    setAuthCode('')
    setFromEmail(creds?.fromEmail || '')
    setFromName(creds?.fromName || "L'équipe OQUI")
  }

  // Add/remove recipients
  const addRecipient = () => {
    const email = newEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Email invalide', variant: 'destructive' })
      return
    }
    if (recipients.includes(email)) {
      toast({ title: 'Doublon', variant: 'destructive' })
      return
    }
    setRecipients([...recipients, email])
    setNewEmail('')
  }

  // Send
  const sendEmails = async () => {
    if (!creds || recipients.length === 0 || !subject.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          subject: subject.trim(),
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          refreshToken: creds.refreshToken,
          fromName: creds.fromName,
          fromEmail: creds.fromEmail,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Emails envoyés', description: data.message })
        const newEntries: HistoryEntry[] = data.results.map((r: SendResult) => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          recipient: r.email,
          subject,
          status: r.status,
          error: r.error,
          date: new Date().toISOString(),
        }))
        saveHistory([...newEntries, ...history])
        setRecipients([])
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const openSetup = () => { resetSetup(); setDialogOpen(true) }

  const formatDate = (d: string) => new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
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
            {creds ? (
              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden sm:inline max-w-32 truncate">{creds.fromEmail}</span>
                <span className="sm:hidden">OK</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 gap-1.5">
                <XCircle className="h-3 w-3" />
                Non connecté
              </Badge>
            )}
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetSetup() }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" onClick={openSetup}>
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
                    {step === 'credentials' && 'Renseignez vos identifiants Google Cloud.'}
                    {step === 'code' && 'Collez le code obtenu après autorisation.'}
                    {step === 'done' && 'Dernière étape : configurez l\'expéditeur.'}
                  </DialogDescription>
                </DialogHeader>

                {step === 'credentials' && (
                  <div className="space-y-4 py-2">
                    <Card className="border-blue-100 bg-blue-50/50">
                      <CardContent className="p-3 text-xs space-y-1 text-blue-800">
                        <p className="font-medium text-blue-900">Préparation Google Cloud</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Allez sur la <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Console Google Cloud</a></li>
                          <li>Créez un <strong>OAuth 2.0 Client ID</strong> (type Web app)</li>
                          <li>Ajoutez <code className="bg-blue-100 px-1 rounded">https://oqui-mailer.vercel.app/api/gmail/callback</code> en URI de redirection</li>
                        </ol>
                      </CardContent>
                    </Card>
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input placeholder="xxxx.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <Input type="password" placeholder="GOCSPX-xxxxx" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                    </div>
                    <Button onClick={generateUrl} disabled={generating || !clientId.trim() || !clientSecret.trim()} className="w-full text-white gap-2" style={{ backgroundColor: '#0b3d2e' }}>
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Se connecter avec Google
                    </Button>
                  </div>
                )}

                {step === 'code' && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <ExternalLink className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-800">Après avoir autorisé l&apos;accès, copiez le code affiché sur la page de retour.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Code d&apos;autorisation</Label>
                      <textarea
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        placeholder="Collez le code ici..."
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep('credentials')}>Retour</Button>
                      <Button onClick={exchangeCode} disabled={exchanging || !authCode.trim()} className="flex-1 text-white gap-2" style={{ backgroundColor: '#0b3d2e' }}>
                        {exchanging ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Valider le code
                      </Button>
                    </div>
                  </div>
                )}

                {step === 'done' && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-800 font-medium">Compte Google autorisé !</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nom de l&apos;expéditeur</Label>
                        <Input placeholder="L'équipe OQUI" value={fromName} onChange={(e) => setFromName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email de l&apos;expéditeur</Label>
                        <Input placeholder="contact@oqui.fr" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
                      </div>
                    </div>
                    <Button onClick={finalize} disabled={!fromEmail.trim()} className="w-full text-white gap-2" style={{ backgroundColor: '#0b3d2e' }}>
                      <CheckCircle2 className="h-4 w-4" />
                      Enregistrer et activer
                    </Button>
                  </div>
                )}

                {creds && (
                  <DialogFooter className="mt-3 pt-3 border-t">
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={() => { disconnect(); setDialogOpen(false) }}>
                      <Trash2 className="h-4 w-4 mr-1" />Déconnecter
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="compose" className="gap-2"><Send className="h-4 w-4" />Composer</TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />Historique
              {history.length > 0 && <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">{history.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-6">
            {!creds && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex items-start sm:items-center gap-3 p-4 flex-col sm:flex-row">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Shield className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Connexion Gmail requise</p>
                    <p className="text-xs text-amber-600">Connectez votre compte Google pour envoyer des emails.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={openSetup} className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
                    <Shield className="h-4 w-4 mr-1" />Connecter
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Destinataires</CardTitle>
                    <CardDescription>Ajoutez les adresses email</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input placeholder="email@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient() } }} />
                      <Button variant="outline" size="icon" onClick={addRecipient} className="shrink-0" style={{ borderColor: '#0b3d2e', color: '#0b3d2e' }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {recipients.length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                          {recipients.map((email) => (
                            <Badge key={email} variant="secondary" className="gap-1.5 py-1.5 px-3">
                              <Mail className="h-3 w-3" />{email}
                              <button onClick={() => setRecipients(recipients.filter((r) => r !== email))} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{recipients.length} destinataire{recipients.length > 1 ? 's' : ''}</span>
                          <Button variant="ghost" size="sm" onClick={() => setRecipients([])} className="text-destructive hover:text-destructive text-xs">Tout supprimer</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Objet</Label>
                      <Input placeholder="Objet de l'email" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Modèle</Label>
                      <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
                        <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#0b3d2e' }}><Mail className="h-4 w-4 text-white" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Retour de test utilisateur - OQUI</p>
                          <p className="text-xs text-muted-foreground">Modèle OQUI prédéfini</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">Prêt</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <Button onClick={sendEmails} disabled={sending || !creds || recipients.length === 0} className="w-full text-white gap-2 h-11" style={{ backgroundColor: '#0b3d2e' }}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sending ? 'Envoi en cours...' : `Envoyer à ${recipients.length} destinataire${recipients.length > 1 ? 's' : ''}`}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="lg:sticky lg:top-24">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div><CardTitle className="text-base">Aperçu</CardTitle><CardDescription>Rendu de l&apos;email</CardDescription></div>
                  <Badge variant="outline" className="gap-1.5"><Eye className="h-3 w-3" />Preview</Badge>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden bg-muted/20" style={{ minHeight: 500 }}>
                    <iframe srcDoc={EMAIL_HTML} title="Preview" className="w-full border-0" style={{ minHeight: 500 }} sandbox="allow-same-origin" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div><CardTitle className="text-base">Historique</CardTitle><CardDescription>Vos envois d&apos;emails</CardDescription></div>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => { saveHistory([]); toast({ title: 'Historique vidé' }) }}>
                  <Trash2 className="h-4 w-4" />Vider
                </Button>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Aucun email envoyé</p>
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
                        {history.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm max-w-48 truncate">{r.recipient}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm max-w-48 truncate">{r.subject}</TableCell>
                            <TableCell>
                              {r.status === 'sent' ? (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1"><CheckCircle2 className="h-3 w-3" />Envoyé</Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 gap-1"><XCircle className="h-3 w-3" />Échoué</Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
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

      <footer className="mt-auto border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">OQUI Mailer &mdash; Gmail API</p>
          <a href="https://oqui.duckdns.org" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">oqui.duckdns.org</a>
        </div>
      </footer>
    </div>
  )
}

const EMAIL_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f5;padding:40px 0"><tr><td align="center">
<table width="600" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,.1)">
<tr><td align="center" style="background:#0b3d2e"><img src="https://z-cdn-media.chatglm.cn/files/c0f3e917-4773-46fc-8a83-d7db599025e3.png?auth_key=1883358409-403fd3c8509f48efb0171a21eb61f6fe-0-1e8aa7fdd04512546f62028abb9eb7f9" alt="OQUI" width="600" style="display:block;width:100%;max-width:600px;height:auto"></td></tr>
<tr><td style="padding:40px;color:#333;font-size:16px;line-height:1.6">
<p style="margin:0 0 20px">Bonjour,</p>
<p style="margin:0 0 20px">Merci pour l&apos;intérêt que vous portez à <strong style="color:#0b3d2e">OQUI</strong>.</p>
<p style="margin:0 0 20px">La phase de test utilisateur est désormais terminée. Nous vous invitons à partager vos retours afin de nous aider à améliorer la plateforme avant son lancement officiel.</p>
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0faf5;border-left:4px solid #0b3d2e;border-radius:4px;margin-bottom:20px"><tr><td style="padding:20px;color:#333;font-size:15px"><strong style="color:#0b3d2e;display:block;margin-bottom:8px">Devenir Partenaire</strong>En participant à cette évaluation, vous pourrez également manifester votre intérêt pour devenir partenaire d&apos;OQUI. Les partenaires sélectionnés pourront bénéficier d&apos;un <strong>compte certifié</strong> ou de l&apos;accès au rôle de <strong>rédacteur</strong>.</td></tr></table>
<p style="margin:0 0 30px">Nous vous invitons à remplir le formulaire suivant :</p>
</td></tr>
<tr><td align="center" style="padding-bottom:40px"><a href="https://docs.google.com/forms/d/e/1FAIpQLSeMJUOCsDKHu3R_YaZJsgEvjyyCDU0Y2z5jLLUnhTu4bWXwtQ/viewform?usp=dialog" target="_blank" style="background:#0b3d2e;color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block">Je participe au test</a></td></tr>
<tr><td style="padding:0 40px 40px;color:#333;font-size:16px;line-height:1.6;border-top:1px solid #eee">
<p style="margin:20px 0 0">Merci pour votre confiance et votre contribution au développement de OQUI.</p>
<p style="margin:10px 0 0"><strong style="color:#0b3d2e">L&apos;équipe OQUI</strong></p>
</td></tr>
</table>
<table width="600" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px"><tr><td align="center" style="color:#888;font-size:12px"><a href="https://oqui.duckdns.org" target="_blank" style="color:#888;text-decoration:underline">oqui.duckdns.org</a></td></tr></table>
</td></tr></table>
</body></html>`