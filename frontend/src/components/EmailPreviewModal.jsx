import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Smartphone, X, Mail, Eye } from 'lucide-react';

export default function EmailPreviewModal({
  isOpen,
  onClose,
  html = '',
  subject = '',
  templateName = 'Email Template'
}) {
  const [deviceView, setDeviceView] = useState('desktop'); // 'desktop' | 'mobile'

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-backdrop-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="preview-modal-surface"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="preview-modal-header">
            <div className="preview-modal-title-group">
              <span className="preview-modal-icon-badge">
                <Eye size={18} />
              </span>
              <div>
                <h3 className="preview-modal-title">Email Preview</h3>
                <span className="preview-modal-subtitle">{templateName}</span>
              </div>
            </div>

            {/* Device Width Toggle */}
            <div className="preview-device-toggle-group">
              <button
                type="button"
                className={`preview-device-btn ${deviceView === 'desktop' ? 'active' : ''}`}
                onClick={() => setDeviceView('desktop')}
                title="Desktop View (600px)"
              >
                <Monitor size={15} />
                <span>Desktop (600px)</span>
              </button>
              <button
                type="button"
                className={`preview-device-btn ${deviceView === 'mobile' ? 'active' : ''}`}
                onClick={() => setDeviceView('mobile')}
                title="Mobile View (375px)"
              >
                <Smartphone size={15} />
                <span>Mobile (375px)</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="btn-close-modal"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subject Bar */}
          {subject && (
            <div className="preview-subject-bar">
              <Mail size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="preview-subject-label">Subject:</span>
              <span className="preview-subject-text">{subject}</span>
            </div>
          )}

          {/* Sandboxed Iframe Container */}
          <div className="preview-iframe-viewport-wrapper">
            <div
              className={`preview-iframe-frame-box ${deviceView === 'mobile' ? 'is-mobile' : 'is-desktop'}`}
            >
              <iframe
                title="Sandboxed Email Preview"
                srcDoc={html}
                sandbox=""
                className="preview-sandboxed-iframe"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
