import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import TemplatesList from './components/TemplatesList.jsx';
import TemplateEditor from './components/TemplateEditor.jsx';
import EmailPreviewModal from './components/EmailPreviewModal.jsx';
import {
  Mail,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  TriangleAlert,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  History,
  Clock,
  Shield,
  ExternalLink,
  MousePointer,
  Slash,
  Layers,
  Copy,
  Check,
  X,
  Activity,
  Sparkles,
  Info
} from 'lucide-react';

// Resolve Backend API base URL flexibly from environment variable or local dev fallback
const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://lmsnotify.onrender.com')
).replace(/\/+$/, '');

// Color palette helper for recipient avatars
const AVATAR_COLORS = [
  '#FF5017', '#16A36A', '#8754F6', '#2563EB',
  '#EA580C', '#0D9488', '#E11D48', '#7C3AED'
];

function getAvatarColor(name = '') {
  if (!name) return AVATAR_COLORS[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// Status options for custom filter dropdown
const STATUS_OPTIONS = [
  { value: 'All', label: 'All Statuses', color: '#71809A' },
  { value: 'Delivered', label: 'Delivered', color: '#16A36A', icon: CheckCircle2 },
  { value: 'Opened', label: 'Opened (Estimated)', color: '#8754F6', icon: Eye },
  { value: 'Clicked', label: 'Clicked', color: '#D97706', icon: ExternalLink },
  { value: 'Sent', label: 'Sent', color: '#2563EB', icon: Send },
  { value: 'Bounced', label: 'Bounced', color: '#EF4444', icon: TriangleAlert },
  { value: 'Blocked', label: 'Blocked', color: '#EA580C', icon: Slash },
  { value: 'Failed', label: 'Failed', color: '#EF4444', icon: XCircle }
];

// SVG Circular Progress Ring Component
function ProgressRing({ percent = 0, color = '#16A36A', size = 56, strokeWidth = 5 }) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg className="progress-ring-svg" width={size} height={size}>
        <circle
          className="progress-ring-circle-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          className="progress-ring-circle-bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className="progress-ring-label">{safePercent}%</span>
    </div>
  );
}

function App() {
  // Application State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [statusBanner, setStatusBanner] = useState({ message: '', type: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');

  // Navigation State
  const [currentView, setCurrentView] = useState('delivery'); // 'delivery' | 'upload'
  const [showCampaignsModal, setShowCampaignsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);

  // Custom Dropdown Open States
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Campaigns & Delivery Tracking State
  const [campaignsList, setCampaignsList] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [mailSent, setMailSent] = useState(false);
  const [mailStatusList, setMailStatusList] = useState([]);
  const [deliveryTotals, setDeliveryTotals] = useState({
    total: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    blocked: 0,
    failed: 0
  });

  // Newsletter Templates State
  const [templatesList, setTemplatesList] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [currentTemplateData, setCurrentTemplateData] = useState(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Sent Email Snapshot Modal State (for Campaign history preview)
  const [isSentEmailModalOpen, setIsSentEmailModalOpen] = useState(false);
  const [sentEmailModalData, setSentEmailModalData] = useState({ html: '', subject: '', templateName: '' });

  // Timeline Expansion State (keyed by messageId)
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [eventsCache, setEventsCache] = useState({});
  const [loadingEvents, setLoadingEvents] = useState({});

  // Search & Filtering State
  const [nameSearch, setNameSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Refs for clicking outside custom dropdowns
  const actionMenuRef = useRef(null);
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActiveActionMenu(null);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show auto-dismissing toast feedback
  const showToast = (text, type = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev && prev.text === text ? null : prev));
    }, 3200);
  };

  // Fetch past campaigns from backend
  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/campaigns`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.campaigns)) {
        setCampaignsList(data.campaigns);
        // If no campaign is loaded yet and campaigns exist, load the latest
        if (!selectedJobId && data.campaigns.length > 0) {
          const latest = data.campaigns[0];
          setSelectedJobId(latest.jobId);
          setMailSent(true);
          fetchDeliveryStatus(latest.jobId, false);
        }
      }
    } catch (err) {
      console.warn('[LMS-Notify] Could not fetch past campaigns:', err.message);
    }
  };

  // Fetch delivery status for a specific campaign
  const fetchDeliveryStatus = async (jobId, showLoading = true) => {
    if (!jobId) return;
    if (showLoading) setIsSyncing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/delivery-status?jobId=${encodeURIComponent(jobId)}`);
      const data = await res.json();
      if (data && data.success) {
        setMailStatusList(data.results || []);
        if (data.totals) setDeliveryTotals(data.totals);
        setLastSyncTime(new Date().toLocaleTimeString());

        // Refresh expanded timelines if any are currently open
        for (const msgId of expandedRows) {
          fetchMessageEvents(msgId);
        }
      }
    } catch (err) {
      console.error('Error fetching delivery status:', err);
      showToast('Failed to sync delivery status. Check connection.', 'error');
    } finally {
      if (showLoading) setIsSyncing(false);
    }
  };

  // Fetch event timeline for a single messageId
  const fetchMessageEvents = async (messageId) => {
    if (!messageId) return;
    setLoadingEvents((prev) => ({ ...prev, [messageId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/events`);
      const data = await res.json();
      if (data && data.success) {
        setEventsCache((prev) => ({ ...prev, [messageId]: data.events || [] }));
      }
    } catch (err) {
      console.error(`Error loading events for messageId ${messageId}:`, err);
    } finally {
      setLoadingEvents((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  // Fetch templates from MongoDB
  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch(`${API_BASE_URL}/templates`);
      const data = await res.json();
      if (data && data.success && data.templates) {
        setTemplatesList(data.templates);
        // Preselect default template if none selected
        setSelectedTemplateId((prev) => {
          if (prev && data.templates.some((t) => t._id === prev)) return prev;
          const def = data.templates.find((t) => t.isDefault) || data.templates[0];
          return def ? def._id : null;
        });
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleNewTemplate = () => {
    setCurrentTemplateData({
      name: 'New Custom Newsletter',
      subject: 'Enhance Your Teaching Experience with Our Learning Platform',
      html: '',
      design: null,
      isDefault: false,
      version: 1
    });
    setEditingTemplateId(null);
    setIsEditingTemplate(true);
    setCurrentView('templates');
  };

  const handleEditTemplate = async (templateId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/templates/${templateId}`);
      const data = await res.json();
      if (data && data.success && data.template) {
        setCurrentTemplateData(data.template);
        setEditingTemplateId(templateId);
        setIsEditingTemplate(true);
        setCurrentView('templates');
      } else {
        showToast('Failed to load template data', 'error');
      }
    } catch (err) {
      showToast('Error loading template: ' + err.message, 'error');
    }
  };

  const handleDuplicateTemplate = async (templateId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/templates/${templateId}/duplicate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('Template duplicated successfully!', 'success');
        fetchTemplates();
      } else {
        showToast(data.message || 'Failed to duplicate template', 'error');
      }
    } catch (err) {
      showToast('Error duplicating template: ' + err.message, 'error');
    }
  };

  const handleSetDefaultTemplate = async (templateId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('Template set as primary default!', 'success');
        fetchTemplates();
      } else {
        showToast(data.message || 'Failed to update template', 'error');
      }
    } catch (err) {
      showToast('Error setting default: ' + err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (templateId, name) => {
    if (templatesList.length <= 1) {
      showToast('Cannot delete the last remaining template', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('Template deleted successfully', 'success');
        fetchTemplates();
      } else {
        showToast(data.message || 'Failed to delete template', 'error');
      }
    } catch (err) {
      showToast('Error deleting template: ' + err.message, 'error');
    }
  };

  const handleSaveSuccess = (savedTemplate) => {
    fetchTemplates();
    setEditingTemplateId(savedTemplate._id);
    setCurrentTemplateData(savedTemplate);
  };

  // Initial load
  useEffect(() => {
    console.log('[LMS-Notify] Initialized modern dashboard v2.1.0 - API Base:', API_BASE_URL);
    fetch(`${API_BASE_URL}/health`).catch(() => {});
    fetchCampaigns();
    fetchTemplates();
  }, []);

  // Poll Brevo API every 12 seconds for the selected campaign
  useEffect(() => {
    if (!mailSent || !selectedJobId) return;

    const interval = setInterval(() => {
      fetchDeliveryStatus(selectedJobId, false);
    }, 12000);

    return () => clearInterval(interval);
  }, [mailSent, selectedJobId, expandedRows]);

  // Formats date to: "Oct 23, 06:16 PM"
  const formatEventDateTime = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Relative opened calculation
  const getOpenedRelative = (dateVal) => {
    if (!dateVal) return 'Opened';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Opened';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Opened just now';
    if (diffMins < 60) return `Opened ${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Opened ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return `Opened on ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  // Last event descriptive text
  const getLastEventDesc = (row) => {
    if (row.failReason) return row.failReason;
    if (row.status === 'Opened') return 'Opened successfully';
    if (row.status === 'Delivered') return 'Delivered successfully';
    if (row.status === 'Blocked') return 'Requests blocked';
    if (row.status === 'Bounced') return 'Mailbox delivery bounced';
    if (row.status === 'Sent') return 'Dispatched to relay';
    return row.lastEvent ? `Event: ${row.lastEvent}` : 'Delivered successfully';
  };

  // Event Label formatter for timeline
  const formatEventLabel = (type) => {
    switch (type) {
      case 'requests': return 'Sent to Server';
      case 'delivered': return 'Delivered to Inbox';
      case 'opened': return 'Opened by Recipient';
      case 'first_opening': return 'First Opened';
      case 'loadedByProxy': return 'Opened by Mail Proxy';
      case 'clicks':
      case 'click': return 'Link Clicked';
      case 'softBounces': return 'Soft Bounced';
      case 'hardBounces': return 'Hard Bounced';
      case 'blocked': return 'Blocked by Provider';
      case 'spam': return 'Marked as Spam';
      case 'failed': return 'Send Failed';
      default: return type || 'Event';
    }
  };

  // Icon for event timeline
  const getTimelineIcon = (type) => {
    switch (type) {
      case 'requests': return <Send size={12} />;
      case 'delivered': return <CheckCircle2 size={12} />;
      case 'opened':
      case 'first_opening': return <Eye size={12} />;
      case 'loadedByProxy': return <Shield size={12} />;
      case 'clicks':
      case 'click': return <MousePointer size={12} />;
      case 'softBounces':
      case 'hardBounces': return <TriangleAlert size={12} />;
      case 'blocked':
      case 'spam': return <Slash size={12} />;
      default: return <Clock size={12} />;
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const isExcel = validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isExcel) {
      setStatusBanner({ message: 'Invalid file format. Please upload an .xlsx or .xls file.', type: 'error' });
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setStatusBanner({ message: '', type: '' });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Trigger Email Dispatch to Backend API
  const handleSendMail = async () => {
    if (!selectedFile) {
      setStatusBanner({ message: 'Please select an Excel file before sending.', type: 'error' });
      return;
    }

    setIsSending(true);
    setStatusBanner({ message: '', type: '' });

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (selectedTemplateId) {
      formData.append('templateId', selectedTemplateId);
    }

    try {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/send-mails`, {
          method: 'POST',
          body: formData,
        });
      } catch (networkErr) {
        if (API_BASE_URL !== '') {
          response = await fetch('/send-mails', {
            method: 'POST',
            body: formData,
          });
        } else {
          throw networkErr;
        }
      }

      const data = await response.json();

      if (response.ok && data.success && data.jobId) {
        setSelectedJobId(data.jobId);
        setMailSent(true);
        setCurrentView('delivery');
        setCurrentPage(1);
        setExpandedRows(new Set());
        fetchDeliveryStatus(data.jobId, true);
        fetchCampaigns();
        showToast('Emails dispatched successfully! Tracking live results via Brevo.', 'success');
      } else {
        setStatusBanner({ message: data.message || 'Failed to process email sending.', type: 'error' });
      }
    } catch (err) {
      console.error('Error sending mails:', err);
      setStatusBanner({
        message: 'Server connection error. Please make sure the backend service is running and reachable.',
        type: 'error'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Switch to a previous campaign
  const handleSelectCampaign = (jobId) => {
    if (!jobId) return;
    setSelectedJobId(jobId);
    setMailSent(true);
    setCurrentView('delivery');
    setExpandedRows(new Set());
    fetchDeliveryStatus(jobId, true);
  };

  // Toggle row timeline expansion
  const handleToggleTimeline = (messageId) => {
    if (!messageId) return;
    const next = new Set(expandedRows);
    if (next.has(messageId)) {
      next.delete(messageId);
    } else {
      next.add(messageId);
      if (!eventsCache[messageId]) {
        fetchMessageEvents(messageId);
      }
    }
    setExpandedRows(next);
  };

  // Reset to Upload mode
  const handleUploadAnother = () => {
    setCurrentView('upload');
    setSelectedFile(null);
    setStatusBanner({ message: '', type: '' });
  };

  // Copy helper with feedback
  const handleCopyText = (text, label = 'Text') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, 'success');
    setActiveActionMenu(null);
  };

  // Multi-field Combined Filter logic
  const filteredResults = useMemo(() => {
    return mailStatusList.filter((item) => {
      const matchesName = item.name
        ? String(item.name).toLowerCase().includes(nameSearch.toLowerCase().trim())
        : false;
      const matchesEmail = item.email
        ? String(item.email).toLowerCase().includes(emailSearch.toLowerCase().trim())
        : false;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesName && matchesEmail && matchesStatus;
    });
  }, [mailStatusList, nameSearch, emailSearch, statusFilter]);

  // Brevo Summary Counts
  const totalCount = deliveryTotals.total || mailStatusList.length;
  const deliveredCount = deliveryTotals.delivered || 0;
  const openedCount = deliveryTotals.opened || 0;
  const bouncedCount = (deliveryTotals.bounced || 0) + (deliveryTotals.blocked || 0) + (deliveryTotals.failed || 0);

  // Safe percentage calculations
  const deliveredPercent = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;
  const openedPercent = totalCount > 0 ? Math.round((openedCount / totalCount) * 100) : 0;
  const bouncedPercent = totalCount > 0 ? Math.round((bouncedCount / totalCount) * 100) : 0;

  // Pagination calculation
  const totalFiltered = filteredResults.length;
  const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalFiltered);
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  // Selected campaign object
  const currentCampaign = useMemo(() => {
    return campaignsList.find((c) => c.jobId === selectedJobId) || null;
  }, [campaignsList, selectedJobId]);

  // Check if current view is the upload spreadsheet screen
  const isUploadView = currentView === 'upload' || (!mailSent && currentView !== 'templates');

  return (
    <div className={`app-viewport ${isUploadView ? 'app-viewport-upload' : ''}`}>
      {/* Decorative Warm Wave Shapes & Dotted Matrix Patterns */}
      <div className="decorative-corner-wave wave-top-left" aria-hidden="true" />
      <div className="decorative-corner-wave wave-bottom-left" aria-hidden="true" />
      <div className="decorative-corner-wave wave-bottom-right" aria-hidden="true" />
      <div className="dot-grid-matrix dots-top-right" aria-hidden="true" />
      <div className="dot-grid-matrix dots-left" aria-hidden="true" />
      <div className="dot-grid-matrix dots-bottom-right" aria-hidden="true" />

      {/* ============================================================ */}
      {/* 1. TOP NAVIGATION BAR                                         */}
      {/* ============================================================ */}
      <header className="top-navbar-wrapper">
        <nav className="top-navbar" aria-label="Main Navigation">
          {/* Brand Logo & Name with Claude + Mail Motif */}
          <div
            className="brand-section"
            onClick={() => {
              if (mailSent) setCurrentView('delivery');
              else setCurrentView('upload');
            }}
          >
            <div className="brand-logo-badge" title="Excel Mail Sender">
              {/* Claude Starburst + Mail Emblem */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="15" rx="3" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M3 5.5L12 12L21 5.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <g transform="translate(12, 13) scale(0.65)">
                  <path d="M 0 -7 C 0.5 -2.5, 2.5 -0.5, 7 0 C 2.5 0.5, 0.5 2.5, 0 7 C -0.5 2.5, -2.5 0.5, -7 0 C -2.5 -0.5, -0.5 -2.5, 0 -7 Z" fill="#FFEEDD" />
                  <circle cx="0" cy="0" r="1.5" fill="#FF5017" />
                </g>
              </svg>
            </div>
            <div className="brand-text-col">
              <span className="brand-app-name">Excel Mail Sender</span>
              <span className="brand-app-subtitle">Send personalized emails via Brevo</span>
            </div>
          </div>

          {/* Navigation Pill Tabs (Delivery Status, Campaigns, Templates) */}
          <div className="nav-pill-group">
            <button
              type="button"
              className={`nav-tab-btn ${currentView === 'delivery' ? 'active' : ''}`}
              onClick={() => {
                if (campaignsList.length > 0 && !mailSent) {
                  const first = campaignsList[0];
                  setSelectedJobId(first.jobId);
                  setMailSent(true);
                  fetchDeliveryStatus(first.jobId, true);
                }
                setIsEditingTemplate(false);
                setCurrentView('delivery');
              }}
            >
              <Activity size={16} />
              <span>Delivery Status</span>
            </button>

            <button
              type="button"
              className="nav-tab-btn"
              onClick={() => setShowCampaignsModal(true)}
            >
              <Send size={15} />
              <span>Campaigns</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${currentView === 'templates' ? 'active' : ''}`}
              onClick={() => {
                setIsEditingTemplate(false);
                setCurrentView('templates');
              }}
            >
              <FileText size={15} />
              <span>Templates</span>
            </button>
          </div>

          {/* Right Header Area: Choose Another Excel Button + Profile */}
          <div className="top-navbar-right">
            {currentView === 'delivery' && mailSent && (
              <button
                type="button"
                onClick={handleUploadAnother}
                className="btn-primary-orange navbar-upload-btn"
                title="Choose another Excel spreadsheet"
              >
                <FileSpreadsheet size={16} />
                <span>Choose Another Excel</span>
              </button>
            )}

            <div className="profile-pill-button">
              <div className="profile-avatar-circle">M</div>
              <div className="profile-text-col">
                <span className="profile-title">My Workspace</span>
                <span className="profile-subtitle">Email Campaign Dashboard</span>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Main App Content Area */}
      <main className={`app-shell ${currentView === 'upload' || (!mailSent && currentView !== 'templates') ? 'app-shell-upload' : ''}`}>
        {/* ============================================================ */}
        {/* VIEW 0: NEWSLETTER TEMPLATES SYSTEM                          */}
        {/* ============================================================ */}
        {currentView === 'templates' ? (
          isEditingTemplate ? (
            <TemplateEditor
              templateId={editingTemplateId}
              initialData={currentTemplateData}
              apiBaseUrl={API_BASE_URL}
              onBack={() => {
                setIsEditingTemplate(false);
                fetchTemplates();
              }}
              onSaveSuccess={handleSaveSuccess}
              showToast={showToast}
            />
          ) : (
            <TemplatesList
              templates={templatesList}
              isLoading={isLoadingTemplates}
              onNewTemplate={handleNewTemplate}
              onEditTemplate={handleEditTemplate}
              onDuplicateTemplate={handleDuplicateTemplate}
              onSetDefaultTemplate={handleSetDefaultTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          )
        ) : currentView === 'delivery' && mailSent ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >

            {/* Statistics Cards Grid (4 Cards with SVG Progress Rings) */}
            <div className="stat-cards-grid">
              {/* Card 1: TOTAL RECIPIENTS */}
              <div className="stat-card">
                <div className="stat-card-left">
                  <div className="stat-icon-wrapper icon-orange">
                    <Users size={20} />
                  </div>
                  <div className="stat-text-col">
                    <span className="stat-card-label label-total">TOTAL RECIPIENTS</span>
                    <span className="stat-card-value">{totalCount}</span>
                    <span className="stat-card-subtext">Total email addresses</span>
                  </div>
                </div>
                <div className="stat-watermark">
                  <Users size={48} />
                </div>
              </div>

              {/* Card 2: DELIVERED */}
              <div className="stat-card">
                <div className="stat-card-left">
                  <div className="stat-icon-wrapper icon-green">
                    <Send size={20} />
                  </div>
                  <div className="stat-text-col">
                    <span className="stat-card-label label-delivered">DELIVERED</span>
                    <span className="stat-card-value">{deliveredCount}</span>
                    <span className="stat-card-subtext">Confirmed in mailbox</span>
                  </div>
                </div>
                <ProgressRing percent={deliveredPercent} color="#16A36A" />
              </div>

              {/* Card 3: OPENED (ESTIMATED) */}
              <div className="stat-card">
                <div className="stat-card-left">
                  <div className="stat-icon-wrapper icon-purple">
                    <Mail size={20} />
                  </div>
                  <div className="stat-text-col">
                    <span className="stat-card-label label-opened">OPENED (ESTIMATED)</span>
                    <span className="stat-card-value">{openedCount}</span>
                    <span className="stat-card-subtext">{openedPercent}% open rate</span>
                  </div>
                </div>
                <ProgressRing percent={openedPercent} color="#8754F6" />
              </div>

              {/* Card 4: BOUNCED */}
              <div className="stat-card">
                <div className="stat-card-left">
                  <div className="stat-icon-wrapper icon-danger">
                    <TriangleAlert size={20} />
                  </div>
                  <div className="stat-text-col">
                    <span className="stat-card-label label-bounced">BOUNCED</span>
                    <span className="stat-card-value">{bouncedCount}</span>
                    <span className="stat-card-subtext">Delivery issues</span>
                  </div>
                </div>
                <ProgressRing percent={bouncedPercent} color="#EF4444" />
              </div>
            </div>

            {/* Email Sending Results Surface Card */}
            <div className="results-surface-card">
              {/* Results Header Bar */}
              <div className="results-header-bar">
                <div className="results-title-group">
                  <div className="results-icon-badge">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="results-title-text">Email Sending Results</h2>
                    <div className="results-live-indicator">
                      <span className="live-pulse-dot" />
                      <span>Last synced: {lastSyncTime || 'Just now'}</span>
                    </div>
                  </div>
                </div>

                <div className="results-controls-right">
                  <button
                    type="button"
                    onClick={() => fetchDeliveryStatus(selectedJobId, true)}
                    disabled={isSyncing}
                    className="btn-secondary-white"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'spin-icon' : ''} />
                    <span>{isSyncing ? 'Syncing...' : 'Refresh Status'}</span>
                  </button>

                  {/* Bespoke Modern Custom Filter Dropdown */}
                  <div className="custom-dropdown-container" ref={filterDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                      className={`custom-dropdown-trigger ${isFilterDropdownOpen ? 'is-open' : ''}`}
                      aria-haspopup="listbox"
                      aria-expanded={isFilterDropdownOpen}
                      title="Filter recipients by status"
                    >
                      <Filter size={14} className="filter-icon" />
                      <span className="dropdown-trigger-label">
                        {STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || 'All Statuses'}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`dropdown-chevron-icon ${isFilterDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isFilterDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className="custom-dropdown-menu"
                          role="listbox"
                        >
                          {STATUS_OPTIONS.map((opt) => {
                            const isSelected = statusFilter === opt.value;
                            const OptIcon = opt.icon;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setStatusFilter(opt.value);
                                  setCurrentPage(1);
                                  setIsFilterDropdownOpen(false);
                                }}
                                className={`custom-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                              >
                                <div className="option-label-group">
                                  <span className="option-status-dot" style={{ backgroundColor: opt.color }} />
                                  {OptIcon && <OptIcon size={13} style={{ color: opt.color }} />}
                                  <span className="option-label-text">{opt.label}</span>
                                </div>
                                {isSelected && <Check size={14} className="option-check-icon" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Dual Search Input Bar */}
              <div className="search-inputs-grid">
                <div className="search-field-wrapper">
                  <Search size={16} className="search-field-icon" />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={nameSearch}
                    onChange={(e) => {
                      setNameSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="search-text-input"
                  />
                  {nameSearch && (
                    <button
                      type="button"
                      onClick={() => setNameSearch('')}
                      className="clear-search-btn"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="search-field-wrapper">
                  <Mail size={16} className="search-field-icon" />
                  <input
                    type="text"
                    placeholder="Search by email..."
                    value={emailSearch}
                    onChange={(e) => {
                      setEmailSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="search-text-input"
                  />
                  {emailSearch && (
                    <button
                      type="button"
                      onClick={() => setEmailSearch('')}
                      className="clear-search-btn"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Recipient Table */}
              {paginatedResults.length > 0 ? (
                <div className="table-outer-wrapper">
                  <table className="recipient-data-table">
                    <thead>
                      <tr>
                        <th className="col-num">#</th>
                        <th>RECIPIENT</th>
                        <th>EMAIL ADDRESS</th>
                        <th>STATUS (BREVO)</th>
                        <th>ACTIVITY / ENGAGEMENT</th>
                        <th>LAST EVENT</th>
                        <th>HISTORY</th>
                        <th style={{ textAlign: 'center' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedResults.map((row) => {
                        const rowKey = row.messageId || `row_${row.rowIndex}`;
                        const isExpanded = expandedRows.has(row.messageId);
                        const firstInitial = row.name ? row.name.charAt(0).toUpperCase() : '?';
                        const avatarBg = getAvatarColor(row.name);

                        return (
                          <React.Fragment key={rowKey}>
                            <tr className="table-data-row">
                              <td className="col-num">{row.rowIndex + 1}</td>

                              <td>
                                <div className="recipient-cell-group">
                                  <div
                                    className="recipient-avatar-circle"
                                    style={{ backgroundColor: avatarBg }}
                                  >
                                    {firstInitial}
                                  </div>
                                  <span className="recipient-name-text">{row.name || 'Unknown'}</span>
                                </div>
                              </td>

                              <td>
                                <span className="email-address-text">{row.email || 'N/A'}</span>
                              </td>

                              <td>
                                {row.status === 'Opened' && (
                                  <span className="status-badge-pill badge-opened">
                                    <Eye size={12} /> Opened
                                  </span>
                                )}
                                {row.status === 'Delivered' && (
                                  <span className="status-badge-pill badge-delivered">
                                    <CheckCircle2 size={12} /> Delivered
                                  </span>
                                )}
                                {row.status === 'Clicked' && (
                                  <span className="status-badge-pill badge-clicked">
                                    <ExternalLink size={12} /> Clicked
                                  </span>
                                )}
                                {row.status === 'Sent' && (
                                  <span className="status-badge-pill badge-sent">
                                    <Send size={12} /> Sent
                                  </span>
                                )}
                                {row.status === 'Blocked' && (
                                  <span className="status-badge-pill badge-blocked">
                                    <Slash size={12} /> Blocked
                                  </span>
                                )}
                                {row.status === 'Failed' && (
                                  <span className="status-badge-pill badge-failed">
                                    <XCircle size={12} /> Failed
                                  </span>
                                )}
                                {row.status === 'Bounced' && (
                                  <span className="status-badge-pill badge-failed">
                                    <TriangleAlert size={12} /> Bounced
                                  </span>
                                )}
                              </td>

                              <td>
                                <div className="activity-cell-stack">
                                  <div className="activity-primary-stat">
                                    <strong>Opens:</strong> {row.openCount || 0}
                                    {row.proxyOpenCount > 0 && (
                                      <span className="proxy-pill-tag">
                                        +{row.proxyOpenCount} proxy
                                      </span>
                                    )}
                                  </div>
                                  {row.failReason ? (
                                    <span className="activity-sub-detail detail-error">
                                      {row.failReason}
                                    </span>
                                  ) : row.status === 'Opened' ? (
                                    <span className="activity-sub-detail detail-success">
                                      {getOpenedRelative(row.firstOpenedAt || row.lastOpenedAt)}
                                    </span>
                                  ) : null}
                                </div>
                              </td>

                              <td>
                                <div className="last-event-cell-stack">
                                  <span className="last-event-timestamp">
                                    {formatEventDateTime(row.lastEventAt || row.sentAt)}
                                  </span>
                                  <span className="last-event-description">
                                    {getLastEventDesc(row)}
                                  </span>
                                </div>
                              </td>

                              <td>
                                {row.messageId ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTimeline(row.messageId)}
                                    className={`btn-view-history ${isExpanded ? 'is-open' : ''}`}
                                    title="View Brevo delivery timeline"
                                  >
                                    <Eye size={12} />
                                    <span>{isExpanded ? 'Hide' : 'View'}</span>
                                  </button>
                                ) : (
                                  <span className="no-history-dash">—</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <div className="action-cell-wrapper" ref={actionMenuRef}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveActionMenu((prev) => (prev === rowKey ? null : rowKey));
                                    }}
                                    className="btn-ellipsis-action"
                                    title="Row Actions"
                                  >
                                    <Ellipsis size={15} />
                                  </button>

                                  {activeActionMenu === rowKey && (
                                    <div className="action-dropdown-menu">
                                      {row.messageId && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(row.messageId, 'Message ID')}
                                          className="action-menu-item"
                                        >
                                          <Copy size={13} />
                                          <span>Copy Message ID</span>
                                        </button>
                                      )}
                                      {row.messageId && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleToggleTimeline(row.messageId);
                                            setActiveActionMenu(null);
                                          }}
                                          className="action-menu-item"
                                        >
                                          <Clock size={13} />
                                          <span>{isExpanded ? 'Hide Timeline' : 'View Timeline'}</span>
                                        </button>
                                      )}
                                      {row.email && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(row.email, 'Email address')}
                                          className="action-menu-item"
                                        >
                                          <Mail size={13} />
                                          <span>Copy Email</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Timeline View for this Row */}
                            {isExpanded && (
                              <tr className="timeline-expansion-row">
                                <td colSpan={8} style={{ padding: 0 }}>
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="timeline-expansion-container"
                                  >
                                    <div className="timeline-header-bar">
                                      <div className="timeline-recipient-title">
                                        <Clock size={16} style={{ color: 'var(--color-primary)' }} />
                                        <span>
                                          Delivery Timeline: {row.name} ({row.email})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="timeline-msgid-code">
                                          ID: {row.messageId}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(row.messageId, 'Message ID')}
                                          className="btn-secondary-white"
                                          style={{ padding: '4px 8px', minHeight: 28, fontSize: 11 }}
                                        >
                                          <Copy size={11} /> Copy
                                        </button>
                                      </div>
                                    </div>

                                    {loadingEvents[row.messageId] && !eventsCache[row.messageId] ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: 'var(--color-muted)' }}>
                                        <RefreshCw size={14} className="spin-icon" />
                                        <span>Loading live event history from Brevo API...</span>
                                      </div>
                                    ) : eventsCache[row.messageId] && eventsCache[row.messageId].length > 0 ? (
                                      <div className="vertical-timeline-track">
                                        {eventsCache[row.messageId].map((ev, i, arr) => {
                                          const isNewest = i === arr.length - 1;
                                          const isProxy = ev.type === 'loadedByProxy';
                                          const nodeClass = `node-${ev.type || 'requests'}`;

                                          return (
                                            <div
                                              key={ev._id || i}
                                              className={`timeline-item-node ${isNewest ? 'is-newest' : ''}`}
                                            >
                                              <div className={`timeline-bullet-circle ${nodeClass}`}>
                                                {getTimelineIcon(ev.type)}
                                              </div>
                                              <div className="timeline-event-content">
                                                <div className="timeline-event-top-line">
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="timeline-event-label">
                                                      {formatEventLabel(ev.type)}
                                                    </span>
                                                    {isProxy && (
                                                      <span className="proxy-pill-tag">
                                                        mail app proxy
                                                      </span>
                                                    )}
                                                    {isNewest && (
                                                      <span className="badge-newest-event">
                                                        Latest Event
                                                      </span>
                                                    )}
                                                  </div>
                                                  <span className="timeline-timestamp-text">
                                                    {new Date(ev.date).toLocaleTimeString([], {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                      second: '2-digit'
                                                    })}{' '}
                                                    • {new Date(ev.date).toLocaleDateString()}
                                                  </span>
                                                </div>

                                                {ev.link && (
                                                  <div className="timeline-link-box">
                                                    Clicked URL: <a href={ev.link} target="_blank" rel="noopener noreferrer">{ev.link}</a>
                                                  </div>
                                                )}

                                                {ev.reason && (
                                                  <div className="timeline-reason-box">
                                                    Reason: {ev.reason}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--color-muted)' }}>
                                        No event history logged yet. Brevo logs typically appear within 1–2 minutes of dispatch.
                                      </div>
                                    )}
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-results-box">
                  <div className="empty-results-icon">
                    <Search size={26} />
                  </div>
                  <h3 className="empty-results-title">No matching recipients found</h3>
                  <p className="empty-results-desc">
                    {nameSearch || emailSearch || statusFilter !== 'All'
                      ? 'Try adjusting your search criteria or resetting the status filter.'
                      : 'No email records exist for this campaign.'}
                  </p>
                  {(nameSearch || emailSearch || statusFilter !== 'All') && (
                    <button
                      type="button"
                      onClick={() => {
                        setNameSearch('');
                        setEmailSearch('');
                        setStatusFilter('All');
                        setCurrentPage(1);
                      }}
                      className="btn-secondary-white"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}

              {/* Strict Pagination Toolbar */}
              <div className="table-pagination-footer">
                <div className="rows-per-page-container">
                  <span>Rows per page:</span>
                  <label className="rows-select-wrapper" title="Rows per page">
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rows-select-box"
                      aria-label="Rows per page"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <ChevronDown size={13} className="rows-dropdown-chevron" />
                  </label>
                </div>

                <div className="pagination-range-text">
                  Showing {totalFiltered > 0 ? startIndex + 1 : 0} – {endIndex} of {totalFiltered} recipients
                </div>

                <div className="pagination-nav-group">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={activePage === 1}
                    className="btn-page-arrow"
                    title="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="page-num-pill-active">{activePage}</span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={activePage === totalPages}
                    className="btn-page-arrow"
                    title="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ============================================================ */
          /* VIEW 2: UPLOAD EXCEL SPREADSHEET (SCREEN 1)                  */
          /* ============================================================ */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="upload-screen-container"
          >
            <div className="upload-two-panel-grid">
            {/* Left Brand Showcase Panel */}
            <div className="upload-left-panel">
              <div className="left-brand-header">
                <div className="brand-logo-badge" title="Excel Mail Sender">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="15" rx="3" fill="#FFFFFF" fillOpacity="0.22" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M3 5.5L12 12L21 5.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <g transform="translate(12, 13) scale(0.65)">
                      <path d="M 0 -7 C 0.5 -2.5, 2.5 -0.5, 7 0 C 2.5 0.5, 0.5 2.5, 0 7 C -0.5 2.5, -2.5 0.5, -7 0 C -2.5 -0.5, -0.5 -2.5, 0 -7 Z" fill="#FFEEDD" />
                      <circle cx="0" cy="0" r="1.5" fill="#FF5017" />
                    </g>
                  </svg>
                </div>
                <span className="left-brand-title">Excel Mail Sender</span>
              </div>

              <div className="left-hero-body">
                <h2 className="left-hero-title">
                  Effortless Batch <span className="hero-title-highlight">Campaigns</span> for Modern Teams
                </h2>
                <p className="left-hero-desc">
                  Upload your spreadsheet, automatically parse personalized variables, and track inbox delivery &amp; real-time opens via Brevo relay.
                </p>

                <div className="left-feature-checklist">
                  <div className="checklist-item">
                    <div className="checklist-bullet"><Check size={13} strokeWidth={3} /></div>
                    <span className="checklist-text">Unique Brevo Message-ID correlation per send</span>
                  </div>
                  <div className="checklist-item">
                    <div className="checklist-bullet"><Check size={13} strokeWidth={3} /></div>
                    <span className="checklist-text">MongoDB Atlas campaign &amp; timeline logging</span>
                  </div>
                  <div className="checklist-item">
                    <div className="checklist-bullet"><Check size={13} strokeWidth={3} /></div>
                    <span className="checklist-text">Reliable recipient event tracking without proxy skew</span>
                  </div>
                </div>
              </div>

              <div className="left-footer-security">
                <Shield size={14} />
                <span>Enterprise Brevo Relay • TLS Encrypted</span>
              </div>
            </div>

            {/* Right Upload Form Panel */}
            <div className="upload-right-panel">
              <div className="upload-workspace-header">
                <div className="workspace-title-row">
                  <h2>Upload Spreadsheet</h2>
                </div>
                <p className="workspace-subtitle">
                  Upload an Excel (.xlsx or .xls) file containing <strong>Name</strong> and <strong>Email</strong> columns.
                </p>
              </div>

              {/* Template Selection Box */}
              <div className="upload-template-select-box">
                <div className="template-select-label-row">
                  <label className="template-select-label">
                    <FileText size={15} style={{ color: 'var(--color-primary)' }} />
                    <span>Email Template</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTemplate(false);
                      setCurrentView('templates');
                    }}
                    className="btn-link-manage-templates"
                  >
                    Manage Templates &rarr;
                  </button>
                </div>

                <div className="template-select-wrapper">
                  <select
                    value={selectedTemplateId || ''}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="template-select-dropdown"
                    aria-label="Select email template"
                  >
                    {templatesList.map((tpl) => (
                      <option key={tpl._id} value={tpl._id}>
                        {tpl.name} {tpl.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {templatesList.find((t) => t._id === selectedTemplateId) && (
                  <div className="template-selected-subject-preview">
                    <span className="subject-preview-label">Subject:</span>
                    <span className="subject-preview-value">
                      {templatesList.find((t) => t._id === selectedTemplateId)?.subject}
                    </span>
                  </div>
                )}
              </div>

              {/* Drag and Drop Zone */}
              <div
                className={`upload-dropzone-box ${isDraggingOver ? 'is-dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('excel-file-hidden-input')?.click()}
              >
                <div className="dropzone-icon-circle">
                  <Upload size={24} />
                </div>
                <h3 className="dropzone-heading">Drag &amp; drop your Excel file here</h3>

                <div className="dropzone-action-row">
                  <span className="dropzone-or">or</span>
                  <span className="btn-browse-files">
                    <FileSpreadsheet size={15} />
                    <span>Choose Excel File</span>
                  </span>
                </div>

                <input
                  type="file"
                  id="excel-file-hidden-input"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="file-input-hidden"
                />

                <p className="file-type-hint">Supports .xlsx and .xls formats</p>

                {selectedFile && (
                  <div className="selected-file-badge" onClick={(e) => e.stopPropagation()}>
                    <CheckCircle2 size={15} style={{ color: 'var(--color-success)' }} />
                    <span>{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="btn-remove-selected-file"
                      title="Remove selected file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Stepper Steps */}
              <div className="workflow-stepper-row">
                <div className="stepper-pill active">
                  <span className="stepper-num">1</span>
                  <span className="stepper-label">Upload</span>
                </div>
                <ChevronRight size={14} className="stepper-chevron" />
                <div className="stepper-pill">
                  <span className="stepper-num">2</span>
                  <span className="stepper-label">Dispatch</span>
                </div>
                <ChevronRight size={14} className="stepper-chevron" />
                <div className="stepper-pill">
                  <span className="stepper-num">3</span>
                  <span className="stepper-label">Track Status</span>
                </div>
              </div>

              {/* Submit Dispatch Button */}
              <button
                type="button"
                onClick={handleSendMail}
                disabled={isSending || !selectedFile}
                className="btn-dispatch-emails"
              >
                {isSending ? (
                  <>
                    <RefreshCw size={17} className="spin-icon" />
                    <span>Sending Emails via Brevo...</span>
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    <span>Send Emails Now</span>
                  </>
                )}
              </button>

              {statusBanner.message && (
                <div className={`status-feedback-banner banner-${statusBanner.type}`}>
                  {statusBanner.type === 'error' ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}
                  <span>{statusBanner.message}</span>
                </div>
              )}

              {/* Back to Delivery Status button if campaigns exist */}
              {campaignsList.length > 0 && (
                <div className="upload-back-delivery-row">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedJobId) setSelectedJobId(campaignsList[0].jobId);
                      setMailSent(true);
                      setCurrentView('delivery');
                    }}
                    className="btn-secondary-white"
                  >
                    <Activity size={13} />
                    <span>View Latest Delivery Status</span>
                  </button>
                </div>
              )}
            </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* ============================================================ */}
      {/* CAMPAIGNS MODAL                                               */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showCampaignsModal && (
          <div className="modal-backdrop-overlay" onClick={() => setShowCampaignsModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="modal-surface-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header-bar">
                <span className="modal-title-text">
                  <Send size={18} style={{ color: 'var(--color-primary)' }} />
                  <span>Email Campaigns</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCampaignsModal(false)}
                  className="btn-close-modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body-scrollable">
                {campaignsList.length > 0 ? (
                  campaignsList.map((c) => (
                    <div
                      key={c.jobId}
                      className={`campaign-item-card ${c.jobId === selectedJobId ? 'is-active' : ''}`}
                      onClick={() => {
                        handleSelectCampaign(c.jobId);
                        setShowCampaignsModal(false);
                      }}
                    >
                      <div className="campaign-card-top-row">
                        <div className="campaign-title-col">
                          <h4 className="campaign-card-title">{c.fileName || c.subject || c.jobId}</h4>
                          <span className="campaign-card-meta">
                            Dispatched: {new Date(c.sentAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>

                        <div className="campaign-card-actions">
                          {c.htmlSnapshot && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSentEmailModalData({
                                  html: c.htmlSnapshot,
                                  subject: c.subjectSnapshot || c.subject,
                                  templateName: c.templateName || c.fileName
                                });
                                setIsSentEmailModalOpen(true);
                              }}
                              className="btn-campaign-view-email"
                              title="View snapshot of the email design sent in this campaign"
                            >
                              <Eye size={13} />
                              <span>View Sent Email</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-campaign-open"
                          >
                            <span>Open</span>
                          </button>
                        </div>
                      </div>

                      <div className="campaign-card-counts">
                        <span className="count-badge badge-total">
                          {c.total} Total
                        </span>
                        {c.templateName && (
                          <span className="count-badge badge-template" title={c.templateName}>
                            <FileText size={11} />
                            <span className="badge-template-text">{c.templateName}</span>
                          </span>
                        )}
                        {c.counts && (
                          <>
                            <span className="count-badge badge-delivered">
                              {c.counts.delivered || 0} Delivered
                            </span>
                            <span className="count-badge badge-opened">
                              {c.counts.opened || 0} Opened
                            </span>
                            <span className="count-badge badge-bounced">
                              {c.counts.bounced || 0} Bounced
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)' }}>
                    No prior campaigns recorded yet.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* FLOATING TOAST NOTIFICATION                                  */}
      {/* ============================================================ */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="toast-floating-container"
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 size={16} style={{ color: '#10B981' }} />
            ) : toastMessage.type === 'error' ? (
              <TriangleAlert size={16} style={{ color: '#EF4444' }} />
            ) : (
              <Info size={16} style={{ color: 'var(--color-primary)' }} />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sent Email Snapshot Preview Modal */}
      <EmailPreviewModal
        isOpen={isSentEmailModalOpen}
        onClose={() => setIsSentEmailModalOpen(false)}
        html={sentEmailModalData.html}
        subject={sentEmailModalData.subject}
        templateName={sentEmailModalData.templateName}
      />
    </div>
  );
}

export default App;
