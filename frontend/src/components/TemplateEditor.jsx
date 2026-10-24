import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import grapesjs from 'grapesjs';
import pluginNewsletter from 'grapesjs-preset-newsletter';
import 'grapesjs/dist/css/grapes.min.css';
import {
  ArrowLeft,
  Save,
  Eye,
  Send,
  Code,
  Layout,
  Variable,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  Mail,
  FileText,
  Sparkles,
  Info
} from 'lucide-react';
import EmailPreviewModal from './EmailPreviewModal.jsx';

const VARIABLES_LIST = [
  { label: 'Recipient Name', placeholder: '{{name}}', desc: "Recipient's personalized name (escaped)" },
  { label: 'Application Link', placeholder: '{{applicationLink}}', desc: 'Call to action button URL' },
  { label: 'Support Email', placeholder: '{{supportEmail}}', desc: 'Help / support email address' },
  { label: 'Sender Name', placeholder: '{{senderName}}', desc: 'Campaign sender signature name' },
  { label: 'Current Year', placeholder: '{{year}}', desc: '4-digit year (e.g. 2026)' }
];

export default function TemplateEditor({
  templateId = null,
  initialData = null,
  apiBaseUrl = '',
  onBack,
  onSaveSuccess,
  showToast
}) {
  // Form fields
  const [name, setName] = useState(initialData?.name || 'New Email Template');
  const [subject, setSubject] = useState(initialData?.subject || 'Enhance Your Teaching Experience with Our Learning Platform');
  const [isDefault, setIsDefault] = useState(initialData?.isDefault || false);
  const [version, setVersion] = useState(initialData?.version || 1);

  // Editor states
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'code'
  const [rawHtmlCode, setRawHtmlCode] = useState(initialData?.html || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warningsList, setWarningsList] = useState([]);

  // Variables dropdown state
  const [isVarDropdownOpen, setIsVarDropdownOpen] = useState(false);

  // Modals
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isTestSendModalOpen, setIsTestSendModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);

  // References
  const gjsContainerRef = useRef(null);
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const varDropdownRef = useRef(null);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Close variables dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (varDropdownRef.current && !varDropdownRef.current.contains(e.target)) {
        setIsVarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Initialize GrapesJS Visual Editor
  useEffect(() => {
    if (!gjsContainerRef.current) return;

    if (!editorRef.current) {
      try {
        const editor = grapesjs.init({
          container: gjsContainerRef.current,
          fromElement: false,
          height: '100%',
          width: 'auto',
          storageManager: false,
          plugins: [pluginNewsletter],
          pluginsOpts: {
            [pluginNewsletter]: {
              modalTitleImport: 'Import Raw Email Template',
              modalLabelImport: 'Paste your raw HTML here'
            }
          }
        });

        // Load existing project design or HTML
        if (initialData?.design && Object.keys(initialData.design).length > 0) {
          editor.loadProjectData(initialData.design);
        } else if (initialData?.html) {
          editor.setComponents(initialData.html);
        }

        // Track edits
        editor.on('update', () => {
          setHasUnsavedChanges(true);
        });

        editorRef.current = editor;
      } catch (err) {
        console.error('[TemplateEditor] GrapesJS init error:', err);
      }
    }

    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch (e) {
          // ignore cleanup error
        }
        editorRef.current = null;
      }
    };
  }, []);

  // Extract Inlined HTML from GrapesJS
  const getEditorInlinedHtml = () => {
    if (!editorRef.current) return rawHtmlCode || '';
    try {
      const inlined = editorRef.current.runCommand('gjs-get-inlined-html');
      if (inlined && typeof inlined === 'string') return inlined;
    } catch (err) {
      // fallback
    }
    const html = editorRef.current.getHtml() || '';
    const css = editorRef.current.getCss() || '';
    return css ? `${html}<style>${css}</style>` : html;
  };

  // Toggle between Visual and Code view
  const handleToggleView = (targetMode) => {
    if (targetMode === viewMode) return;

    if (targetMode === 'code') {
      // Sync from Visual to Code
      const currentHtml = getEditorInlinedHtml();
      setRawHtmlCode(currentHtml);
      setViewMode('code');
    } else {
      // Sync from Code to Visual
      if (editorRef.current) {
        editorRef.current.setComponents(rawHtmlCode);
      }
      setViewMode('visual');
    }
  };

  // Insert variable tag into cursor position
  const handleInsertVariable = (placeholder) => {
    if (viewMode === 'code') {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const updated = text.substring(0, start) + placeholder + text.substring(end);
        setRawHtmlCode(updated);
        setHasUnsavedChanges(true);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 10);
      }
    } else {
      // If in Visual view, insert into active GrapesJS text component or copy to clipboard
      if (editorRef.current) {
        const selected = editorRef.current.getSelected();
        if (selected && selected.is('text')) {
          const currentContent = selected.get('content') || '';
          selected.set('content', currentContent + ' ' + placeholder);
          setHasUnsavedChanges(true);
        } else {
          // Copy to clipboard with toast helper
          navigator.clipboard.writeText(placeholder);
          if (showToast) {
            showToast(`Copied ${placeholder} to clipboard! Paste it inside any text block.`, 'info');
          }
        }
      }
    }
    setIsVarDropdownOpen(false);
  };

  // Open Sandboxed Preview Modal
  const handleOpenPreview = async () => {
    let currentHtml = '';
    if (viewMode === 'code') {
      currentHtml = rawHtmlCode;
    } else {
      currentHtml = getEditorInlinedHtml();
    }

    try {
      const res = await fetch(`${apiBaseUrl}/templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: currentHtml, sampleName: 'Priya' })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewHtml(data.html);
      } else {
        setPreviewHtml(currentHtml);
      }
    } catch (err) {
      setPreviewHtml(currentHtml);
    }

    setIsPreviewOpen(true);
  };

  // Save Template to Backend MongoDB
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please provide a template name.');
      return;
    }
    if (!subject.trim()) {
      alert('Please provide an email subject.');
      return;
    }

    setIsSaving(true);
    setWarningsList([]);

    let finalHtml = '';
    let finalDesign = null;

    if (viewMode === 'code') {
      finalHtml = rawHtmlCode;
      if (editorRef.current) {
        editorRef.current.setComponents(rawHtmlCode);
        finalDesign = editorRef.current.getProjectData();
      }
    } else {
      finalHtml = getEditorInlinedHtml();
      if (editorRef.current) {
        finalDesign = editorRef.current.getProjectData();
      }
    }

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      html: finalHtml,
      design: finalDesign,
      isDefault
    };

    try {
      const url = templateId
        ? `${apiBaseUrl}/templates/${templateId}`
        : `${apiBaseUrl}/templates`;
      const method = templateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setHasUnsavedChanges(false);
        if (data.template) {
          setVersion(data.template.version || 1);
        }
        if (data.warnings && data.warnings.length > 0) {
          setWarningsList(data.warnings);
        }
        if (showToast) {
          showToast(`Template saved successfully (v${data.template?.version || 1})!`, 'success');
        }
        if (onSaveSuccess) {
          onSaveSuccess(data.template);
        }
      } else {
        alert(data.message || 'Failed to save template.');
      }
    } catch (err) {
      console.error('[TemplateEditor] Save error:', err);
      alert('Network error while saving template: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Send Single Test Mail via Brevo
  const handleSendTestMail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      setTestFeedback({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    if (!templateId) {
      setTestFeedback({
        type: 'error',
        message: 'Please save your template first before sending a live test mail.'
      });
      return;
    }

    setIsSendingTest(true);
    setTestFeedback(null);

    try {
      const res = await fetch(`${apiBaseUrl}/templates/${templateId}/test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: testEmailAddress.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestFeedback({
          type: 'success',
          message: data.message || `Test email dispatched to ${testEmailAddress}!`
        });
        if (showToast) {
          showToast(`Test mail sent to ${testEmailAddress}!`, 'success');
        }
      } else {
        setTestFeedback({
          type: 'error',
          message: data.message || 'Failed to dispatch test email.'
        });
      }
    } catch (err) {
      setTestFeedback({
        type: 'error',
        message: 'Network error: ' + err.message
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Safe back navigation check
  const handleSafeBack = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave without saving?')) {
        return;
      }
    }
    onBack();
  };

  return (
    <div className="template-editor-shell">
      {/* Top Editor Toolbar */}
      <div className="editor-top-nav-bar">
        {/* Left: Back & Title Group */}
        <div className="editor-nav-left">
          <button
            type="button"
            onClick={handleSafeBack}
            className="btn-back-link"
            title="Return to templates list"
          >
            <ArrowLeft size={16} />
            <span>Templates</span>
          </button>

          <div className="editor-title-divider" />

          <div className="editor-title-inputs-group">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Template Name..."
              className="editor-input-name"
              title="Template Name"
            />
            <span className="editor-version-tag">v{version}</span>
          </div>
        </div>

        {/* Right: Actions (Visual/Code, Insert Var, Preview, Test Send, Save) */}
        <div className="editor-nav-right">
          {/* Visual | Code Mode Toggle */}
          <div className="editor-mode-toggle-group">
            <button
              type="button"
              className={`mode-toggle-btn ${viewMode === 'visual' ? 'active' : ''}`}
              onClick={() => handleToggleView('visual')}
              title="Drag-and-drop Visual Editor"
            >
              <Layout size={14} />
              <span>Visual</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
              onClick={() => handleToggleView('code')}
              title="Raw HTML Code Editor"
            >
              <Code size={14} />
              <span>Code</span>
            </button>
          </div>

          {/* Insert Variable Dropdown */}
          <div className="editor-var-dropdown-wrapper" ref={varDropdownRef}>
            <button
              type="button"
              onClick={() => setIsVarDropdownOpen(!isVarDropdownOpen)}
              className="btn-editor-secondary"
              title="Insert placeholder tags like {{name}}"
            >
              <Variable size={15} />
              <span>Insert Variable</span>
              <ChevronDown size={14} />
            </button>

            <AnimatePresence>
              {isVarDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="editor-var-menu"
                >
                  <div className="editor-var-menu-header">
                    <span>Available Dynamic Tags</span>
                  </div>
                  {VARIABLES_LIST.map((item) => (
                    <button
                      key={item.placeholder}
                      type="button"
                      className="editor-var-menu-item"
                      onClick={() => handleInsertVariable(item.placeholder)}
                    >
                      <div className="var-item-left">
                        <span className="var-item-label">{item.label}</span>
                        <span className="var-item-desc">{item.desc}</span>
                      </div>
                      <code className="var-item-tag">{item.placeholder}</code>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Preview Button */}
          <button
            type="button"
            onClick={handleOpenPreview}
            className="btn-editor-secondary"
            title="Preview rendered email in desktop & mobile viewports"
          >
            <Eye size={15} />
            <span>Preview</span>
          </button>

          {/* Send Test Button */}
          <button
            type="button"
            onClick={() => {
              setTestFeedback(null);
              setIsTestSendModalOpen(true);
            }}
            className="btn-editor-secondary"
            title="Send test email to your inbox"
          >
            <Send size={15} />
            <span>Send Test</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary-orange"
            style={{ minHeight: 38, padding: '0 18px' }}
            title="Save template changes to database"
          >
            <Save size={15} />
            <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* Subject Line Input Toolbar */}
      <div className="editor-subject-bar">
        <Mail size={16} className="subject-bar-icon" />
        <label className="subject-bar-label">Subject:</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setHasUnsavedChanges(true);
          }}
          placeholder="Email Subject Line (e.g. Enhance Your Teaching Experience with Our Learning Platform)"
          className="subject-bar-input"
        />
      </div>

      {/* Sanitization Warnings Banner */}
      {warningsList.length > 0 && (
        <div className="editor-warnings-banner">
          <div className="warnings-banner-header">
            <AlertTriangle size={16} />
            <span>Template Quality Notice:</span>
            <button
              type="button"
              onClick={() => setWarningsList([])}
              className="warnings-close-btn"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="warnings-list">
            {warningsList.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Work Area: Visual Canvas OR Code Textarea */}
      <div className="editor-canvas-container">
        {/* Visual GrapesJS Canvas */}
        <div
          ref={gjsContainerRef}
          id="gjs-canvas"
          className="gjs-viewport-frame"
          style={{ display: viewMode === 'visual' ? 'block' : 'none', height: '100%' }}
        />

        {/* Raw Code Editor Textarea */}
        {viewMode === 'code' && (
          <div className="code-editor-container">
            <div className="code-editor-toolbar">
              <span className="code-toolbar-title">
                <Code size={14} />
                <span>Raw HTML Code View</span>
              </span>
              <span className="code-toolbar-hint">
                Edit or paste complete email HTML. Scripts and unsafe event handlers are automatically sanitized upon save.
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={rawHtmlCode}
              onChange={(e) => {
                setRawHtmlCode(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Paste or write raw email HTML template here..."
              className="code-editor-textarea"
              spellCheck={false}
            />
          </div>
        )}
      </div>

      {/* Sandboxed Preview Modal */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        html={previewHtml}
        subject={subject}
        templateName={name}
      />

      {/* Test Send Dialog Modal */}
      <AnimatePresence>
        {isTestSendModalOpen && (
          <div className="modal-backdrop-overlay" onClick={() => setIsTestSendModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="modal-surface-container"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header-bar">
                <span className="modal-title-text">
                  <Send size={18} style={{ color: 'var(--color-primary)' }} />
                  <span>Send Test Email</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsTestSendModalOpen(false)}
                  className="btn-close-modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                  Dispatch a real test message via Brevo using sample recipient data (<strong>Priya</strong>) and tag <code>template-test</code>. This does not create a campaign record.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>
                    Recipient Email Address:
                  </label>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="e.g. yourname@example.com"
                    className="modal-input-field"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 14,
                      outline: 'none'
                    }}
                  />
                </div>

                {testFeedback && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                      background: testFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                      color: testFeedback.type === 'success' ? '#065F46' : '#991B1B',
                      border: `1px solid ${testFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`
                    }}
                  >
                    {testFeedback.message}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setIsTestSendModalOpen(false)}
                    className="btn-secondary-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTestMail}
                    disabled={isSendingTest || !testEmailAddress}
                    className="btn-primary-orange"
                  >
                    <Send size={14} />
                    <span>{isSendingTest ? 'Sending...' : 'Send Test'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
