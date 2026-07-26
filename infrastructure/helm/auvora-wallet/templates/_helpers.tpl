{{/*
Expand the name of the chart.
*/}}
{{- define "auvora-wallet.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "auvora-wallet.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart labels
*/}}
{{- define "auvora-wallet.labels" -}}
helm.sh/chart: {{ include "auvora-wallet.chart" . }}
{{ include "auvora-wallet.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: auvora
{{- end }}

{{- define "auvora-wallet.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "auvora-wallet.selectorLabels" -}}
app.kubernetes.io/name: {{ include "auvora-wallet.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service-specific labels
*/}}
{{- define "auvora-wallet.serviceLabels" -}}
{{ include "auvora-wallet.labels" .root }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/service: {{ .name }}
{{- end }}

{{/*
Service selector labels
*/}}
{{- define "auvora-wallet.serviceSelectorLabels" -}}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/service: {{ .name }}
{{- end }}

{{/*
Active traffic selector — blue/green uses slot; rolling/canary use stable track.
*/}}
{{- define "auvora-wallet.trafficSelectorLabels" -}}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/service: {{ .name }}
{{- $strategy := default "rolling" .root.Values.global.deploymentStrategy -}}
{{- if eq $strategy "blue-green" }}
auvora.io/slot: {{ .root.Values.global.blueGreen.activeSlot | default "blue" | quote }}
{{- else }}
auvora.io/track: stable
{{- end }}
{{- end }}

{{/*
Image reference
*/}}
{{- define "auvora-wallet.image" -}}
{{- $registry := .root.Values.global.imageRegistry -}}
{{- $repo := .image -}}
{{- $tag := default .root.Values.global.imageTag .tag -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- end }}

{{/*
Namespace
*/}}
{{- define "auvora-wallet.namespace" -}}
{{- default "auvora-wallet" .Values.global.namespace -}}
{{- end }}

{{/*
Service account name
*/}}
{{- define "auvora-wallet.serviceAccountName" -}}
{{- printf "%s-sa" .name -}}
{{- end }}

{{/*
Secret name used by pods
*/}}
{{- define "auvora-wallet.secretName" -}}
{{- if .Values.secrets.existingSecretName -}}
{{- .Values.secrets.existingSecretName -}}
{{- else -}}
{{- printf "%s-secrets" (include "auvora-wallet.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Deployment strategy block for rolling / blue-green / canary
*/}}
{{- define "auvora-wallet.podStrategy" -}}
{{- $strategy := default "rolling" .Values.global.deploymentStrategy -}}
{{- if eq $strategy "blue-green" }}
type: RollingUpdate
rollingUpdate:
  maxUnavailable: 0
  maxSurge: 100%
{{- else if eq $strategy "canary" }}
type: RollingUpdate
rollingUpdate:
  maxUnavailable: 0
  maxSurge: 25%
{{- else }}
type: RollingUpdate
rollingUpdate:
  maxUnavailable: 0
  maxSurge: 1
{{- end }}
{{- end }}
