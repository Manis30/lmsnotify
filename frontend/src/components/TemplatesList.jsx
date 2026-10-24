import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Star,
  Copy,
  Trash2,
  Edit3,
  Clock,
  Mail,
  Search,
  CheckCircle2,
  Sparkles,
  Layers
} from 'lucide-react';

export default function TemplatesList({
  templates = [],
  isLoading = false,
  onNewTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onSetDefaultTemplate,
  onDeleteTemplate
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q))
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="templates-view-container"
    >
      {/* Search Toolbar with New Template Button */}
      <div className="template-toolbar-card">
        <div className="template-search-wrapper">
          <Search size={16} className="search-icon-left" />
          <input
            type="text"
            placeholder="Search templates by name or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="template-search-input"
          />
        </div>

        <div className="template-toolbar-right">
          <div className="template-count-indicator">
            <span>{templates.length} template{templates.length === 1 ? '' : 's'} available</span>
          </div>

          <button
            type="button"
            onClick={onNewTemplate}
            className="btn-primary-orange btn-new-template-toolbar"
          >
            <Plus size={16} />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Templates Grid / Cards */}
      {isLoading ? (
        <div className="templates-loading-box">
          <div className="spinner-primary" />
          <p>Loading email templates from MongoDB...</p>
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="templates-grid">
          {filteredTemplates.map((tpl) => (
            <motion.div
              key={tpl._id}
              className={`template-card ${tpl.isDefault ? 'is-default-card' : ''}`}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
            >
              {/* Card Header */}
              <div className="template-card-header">
                <div className="template-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div className="template-card-badges">
                  {tpl.isDefault && (
                    <span className="template-badge-default" title="Primary default template for campaigns">
                      <Star size={12} fill="#FF5017" />
                      <span>Default</span>
                    </span>
                  )}
                  <span className="template-badge-version">v{tpl.version || 1}</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="template-card-body">
                <h3 className="template-card-name" title={tpl.name}>
                  {tpl.name}
                </h3>
                <div className="template-card-subject">
                  <Mail size={13} className="subject-icon" />
                  <span title={tpl.subject}>{tpl.subject}</span>
                </div>
              </div>

              {/* Card Footer / Meta */}
              <div className="template-card-meta">
                <span className="meta-updated-text">
                  <Clock size={12} />
                  <span>
                    Updated {new Date(tpl.updatedAt || tpl.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </span>
              </div>

              {/* Card Action Buttons */}
              <div className="template-card-actions">
                <button
                  type="button"
                  onClick={() => onEditTemplate(tpl._id)}
                  className="btn-template-action btn-edit"
                  title="Open visual editor"
                >
                  <Edit3 size={14} />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDuplicateTemplate(tpl._id)}
                  className="btn-template-action"
                  title="Duplicate template"
                >
                  <Copy size={14} />
                  <span>Duplicate</span>
                </button>

                {!tpl.isDefault && (
                  <button
                    type="button"
                    onClick={() => onSetDefaultTemplate(tpl._id)}
                    className="btn-template-action"
                    title="Set as default template"
                  >
                    <Star size={14} />
                    <span>Set Default</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDeleteTemplate(tpl._id, tpl.name)}
                  disabled={templates.length <= 1}
                  className={`btn-template-action btn-delete ${templates.length <= 1 ? 'is-disabled' : ''}`}
                  title={templates.length <= 1 ? 'Cannot delete the last remaining template' : 'Delete template'}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="empty-results-box" style={{ background: '#FFFFFF', padding: '48px 24px' }}>
          <div className="empty-results-icon">
            <FileText size={32} />
          </div>
          <h3 className="empty-results-title">No templates found</h3>
          <p className="empty-results-desc">
            {searchQuery
              ? `No templates match "${searchQuery}". Try a different keyword.`
              : 'Create your first email template to get started with custom newsletters.'}
          </p>
          <button
            type="button"
            onClick={onNewTemplate}
            className="btn-primary-orange"
            style={{ margin: '16px auto 0' }}
          >
            <Plus size={16} />
            <span>Create New Template</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
