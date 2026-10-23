import React, { useState } from 'react';
import './App.css';
import {
  FiMail,
  FiUploadCloud,
  FiFileText,
  FiFolder,
  FiUsers,
  FiSend,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiBarChart2,
  FiTrendingUp,
  FiZap,
  FiShield,
  FiUser,
  FiCheck,
  FiRefreshCw,
  FiX
} from 'react-icons/fi';

// Backend API base URL from Vite environment variable or Render default
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://lmsnotify.onrender.com').replace(/\/+$/, '');

function App() {
  // Application State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [statusBanner, setStatusBanner] = useState({ message: '', type: '' });
  
  // Mail sending state
  const [mailSent, setMailSent] = useState(false);
  const [mailStatusList, setMailStatusList] = useState([]);
  const [sentTimestamp, setSentTimestamp] = useState('');

  // Filtering State for Screen 2
  const [nameSearch, setNameSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination State for Screen 2
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Helper to format initial avatar color
  const getAvatarColor = (name) => {
    const colors = [
      '#8b5cf6', '#3b82f6', '#f97316', '#14b8a6', 
      '#ec4899', '#6366f1', '#10b981', '#f59e0b'
    ];
    if (!name) return colors[0];
    let charCodeSum = 0;
    for (let i = 0; i < name.length; i++) {
      charCodeSum += name.charCodeAt(i);
    }
    return colors[charCodeSum % colors.length];
  };

  // Compact timestamp string for table display
  const getFormattedTimestamp = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr}, ${timeStr}`;
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
    }
  };

  // Clear file input on click to allow re-selecting same file
  const handleFileInputClick = (e) => {
    e.target.value = null;
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

    try {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/send-mails`, {
          method: 'POST',
          body: formData,
        });
      } catch (networkErr) {
        // Fallback to relative endpoint if API_BASE_URL is not relative and failed
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

      if (response.ok && data.success) {
        const timeStr = getFormattedTimestamp();
        setSentTimestamp(timeStr);
        const updatedResults = (data.results || []).map((row) => ({
          ...row,
          sentAt: timeStr
        }));
        setMailStatusList(updatedResults);
        setMailSent(true);
        setCurrentPage(1);
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

  // Reset to Upload mode for sending another Excel
  const handleUploadAnother = () => {
    setMailSent(false);
    setSelectedFile(null);
    setStatusBanner({ message: '', type: '' });
    setNameSearch('');
    setEmailSearch('');
    setStatusFilter('All');
  };

  // Multi-field Combined Filter logic
  const filteredResults = mailStatusList.filter((item) => {
    const matchesName = item.name
      ? String(item.name).toLowerCase().includes(nameSearch.toLowerCase().trim())
      : false;
    const matchesEmail = item.email
      ? String(item.email).toLowerCase().includes(emailSearch.toLowerCase().trim())
      : false;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesName && matchesEmail && matchesStatus;
  });

  // Calculate Summary Counts
  const totalCount = mailStatusList.length;
  const successCount = mailStatusList.filter((item) => item.status === 'Success').length;
  const failedCount = mailStatusList.filter((item) => item.status === 'Failed').length;

  // Pagination calculation
  const totalFiltered = filteredResults.length;
  const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  
  const startIndex = (activePage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalFiltered);
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  // Filter & Pagination Handlers
  const handleNameSearchChange = (e) => {
    setNameSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleEmailSearchChange = (e) => {
    setEmailSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="bg-glow-wrapper">
      
      {/* Background Decorative Graphics */}
      <div className="dot-pattern-top-left"></div>
      <div className="dot-pattern-bottom-right"></div>

      <div className="app-container">
        <div className={`main-card ${mailSent ? 'is-results-view' : ''}`}>
          
          {mailSent && (
            <header className="app-header app-header-results">
              <div className="header-icon-badge-wrapper">
                <div className="header-icon-badge">
                  <FiMail size={18} />
                </div>
              </div>
              <h1>Excel Mail <span className="title-gradient">Sender</span></h1>
            </header>
          )}

          {!mailSent ? (
            /* ============================================================ */
            /* SCREEN 1: INITIAL UPLOAD PAGE                                */
            /* ============================================================ */
            <div className="two-panel-grid">
              
              {/* LEFT SIDE: Visual & Features */}
              <div className="left-panel">
                <div className="branding-illustration-wrapper">
                  <svg width="180" height="135" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Background Soft Circle */}
                    <circle cx="100" cy="75" r="58" fill="white" opacity="0.08" />
                    
                    {/* Excel Card Document */}
                    <rect x="52" y="18" width="96" height="114" rx="10" fill="#FFFFFF" />
                    
                    {/* Checklist Lines */}
                    <rect x="76" y="38" width="54" height="4" rx="2" fill="#E2E8F0" />
                    <path d="M63 38L66 41L71 35" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    
                    <rect x="76" y="54" width="48" height="4" rx="2" fill="#E2E8F0" />
                    <path d="M63 54L66 57L71 51" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    
                    <rect x="76" y="70" width="52" height="4" rx="2" fill="#E2E8F0" />
                    <path d="M63 70L66 73L71 67" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    
                    <rect x="76" y="86" width="42" height="4" rx="2" fill="#E2E8F0" />
                    <path d="M63 86L66 89L71 83" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    
                    <rect x="76" y="102" width="48" height="4" rx="2" fill="#E2E8F0" />
                    <path d="M63 102L66 105L71 99" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {/* Green Excel Badge Icons "X" */}
                    <rect x="24" y="42" width="36" height="36" rx="8" fill="#10B981" />
                    <text x="42" y="66" fill="white" fontSize="19" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">X</text>
                    
                    <rect x="138" y="74" width="38" height="38" rx="8" fill="#10B981" />
                    <text x="157" y="100" fill="white" fontSize="20" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">X</text>
                    
                    {/* Floating Accent Sparkles */}
                    <circle cx="28" cy="22" r="2.5" fill="white" opacity="0.8" />
                    <path d="M174 20L175.5 23.5L179 25L175.5 26.5L174 30L172.5 26.5L169 25L172.5 23.5Z" fill="white" opacity="0.9" />
                  </svg>
                </div>

                <h3 className="brand-tagline">
                  Simple.<br />
                  <span className="highlight-purple-text">Personalized.</span><br />
                  Efficient.
                </h3>

                <div className="brand-divider"></div>

                <div className="feature-rows-list">
                  <div className="feature-row-item">
                    <div className="feature-icon-circle icon-white">
                      <FiUsers size={16} color="#4f46e5" />
                    </div>
                    <div className="feature-row-text">
                      <h4>Bulk Email Sending</h4>
                      <p>Send personalized emails to multiple recipients</p>
                    </div>
                  </div>

                  <div className="feature-row-item">
                    <div className="feature-icon-circle icon-white">
                      <FiZap size={16} color="#10b981" />
                    </div>
                    <div className="feature-row-text">
                      <h4>Real-time Processing</h4>
                      <p>Track every email status in real-time</p>
                    </div>
                  </div>

                  <div className="feature-row-item">
                    <div className="feature-icon-circle icon-white">
                      <FiShield size={16} color="#f97316" />
                    </div>
                    <div className="feature-row-text">
                      <h4>Secure &amp; Reliable</h4>
                      <p>Your data is processed securely</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: Upload Workspace */}
              <div className="right-panel">
                
                {/* Application Header inside Workspace */}
                <header className="app-header-workspace">
                  <div className="header-icon-badge">
                    <FiMail size={20} color="#ffffff" />
                  </div>
                  <h1>Excel Mail <span className="title-gradient">Sender</span></h1>
                  <p className="header-subtitle">Send personalized emails to multiple recipients with ease.</p>
                </header>

                <div className="upload-form-card">
                  <div className="form-heading-row">
                    <div className="upload-folder-icon-circle">
                      <FiFolder size={18} color="#6366f1" />
                    </div>
                    <div>
                      <h2>Upload Excel Spreadsheet</h2>
                      <p className="form-subtitle">Upload a file containing Name and Email columns.</p>
                    </div>
                  </div>

                  <div className="upload-drop-box">
                    <div className="cloud-upload-icon-circle">
                      <FiUploadCloud size={24} color="#6366f1" />
                    </div>

                    <h3>Drag &amp; drop your Excel file here</h3>
                    <p className="or-text">or</p>

                    <input
                      type="file"
                      id="excel-file-input"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      onClick={handleFileInputClick}
                      className="file-input-hidden"
                    />

                    <label htmlFor="excel-file-input" className="btn-choose-file-purple">
                      <FiFileText size={14} style={{ marginRight: 6 }} /> Choose Excel File
                    </label>

                    <p className="file-hint-text">.xlsx / .xls files only</p>

                    <div className="selected-filename-area">
                      {selectedFile ? (
                        <span className="file-badge">
                          <FiCheckCircle size={14} style={{ marginRight: 5, color: '#16a34a' }} />
                          <span className="file-badge-name">{selectedFile.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                            }}
                            className="btn-remove-file"
                            title="Remove file"
                          >
                            <FiX size={14} />
                          </button>
                        </span>
                      ) : (
                        <span className="no-file-text">No file selected</span>
                      )}
                    </div>
                  </div>

                  {/* Numbered Workflow Steps Pills (1, 2, 3) */}
                  <div className="workflow-steps-pills">
                    <div className="step-pill active">
                      <span className="step-num active">1</span>
                      <span className="step-label">Upload</span>
                    </div>
                    <FiChevronRight size={14} className="step-chevron" />

                    <div className="step-pill">
                      <span className="step-num">2</span>
                      <span className="step-label">Review &amp; Send</span>
                    </div>
                    <FiChevronRight size={14} className="step-chevron" />

                    <div className="step-pill">
                      <span className="step-num">3</span>
                      <span className="step-label">Track Results</span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <div className="send-action-area">
                    <button
                      onClick={handleSendMail}
                      disabled={isSending || !selectedFile}
                      className={`btn-send-primary-gradient ${isSending ? 'is-loading' : ''}`}
                    >
                      <span className="btn-send-text">
                        {isSending ? (
                          <>
                            <FiRefreshCw size={16} className="animate-spin" style={{ marginRight: 8 }} />
                            Sending Emails...
                          </>
                        ) : (
                          <>
                            <FiSend size={15} style={{ marginRight: 8 }} />
                            Send Personalized Emails
                          </>
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Show statusBanner ONLY for errors */}
                  {!isSending && statusBanner.message && (
                    <div className={`status-banner status-${statusBanner.type}`}>
                      {statusBanner.message}
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            /* ============================================================ */
            /* SCREEN 2: EMAIL SENDING RESULTS                              */
            /* ============================================================ */
            <div className="results-stacked-container">
              
              {/* 1. MAIL STATUS SECTION HEADER */}
              <div className="section-header-block">
                <div className="section-title-group">
                  <div className="section-icon-badge">
                    <FiBarChart2 size={16} />
                  </div>
                  <div>
                    <h2>Mail Status</h2>
                    <p className="section-subtitle">Overview of your email campaign</p>
                  </div>
                </div>
              </div>

              {/* 2. COMPACT STATS CARDS */}
              <div className="stat-cards-horizontal-grid">
                
                {/* TOTAL RECIPIENTS CARD */}
                <div className="stat-card stat-card-total">
                  <div className="stat-card-header">
                    <div className="stat-icon-wrapper icon-total">
                      <FiUsers size={14} />
                    </div>
                    <span className="stat-card-title title-total">TOTAL RECIPIENTS</span>
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-number">{totalCount}</span>
                    <span className="stat-subtext">Total email addresses</span>
                  </div>
                </div>

                {/* SUCCESSFULLY SENT CARD */}
                <div className="stat-card stat-card-success">
                  <div className="stat-card-header">
                    <div className="stat-icon-wrapper icon-success">
                      <FiSend size={14} />
                    </div>
                    <span className="stat-card-title title-success">SUCCESSFULLY SENT</span>
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-number">{successCount}</span>
                    <span className="stat-subtext">Emails sent successfully</span>
                  </div>
                </div>

                {/* FAILED CARD */}
                <div className="stat-card stat-card-failed">
                  <div className="stat-card-header">
                    <div className="stat-icon-wrapper icon-failed">
                      <FiAlertTriangle size={14} />
                    </div>
                    <span className="stat-card-title title-failed">FAILED</span>
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-number">{failedCount}</span>
                    <span className="stat-subtext">Need attention</span>
                  </div>
                </div>

              </div>

              {/* 3. RESULTS HEADER ROW WITH CHOOSE ANOTHER EXCEL BUTTON */}
              <div className="results-header-row">
                <div className="results-title-group">
                  <div className="title-icon-circle">
                    <FiTrendingUp size={16} />
                  </div>
                  <h2>Email Sending Results</h2>
                </div>

                <button onClick={handleUploadAnother} className="btn-choose-another-top">
                  <FiFolder size={13} style={{ marginRight: 5 }} /> Choose Another Excel
                </button>
              </div>

              {/* 4. SEARCH & FILTER CONTROLS */}
              <div className="filters-bar">
                <div className="filter-input-wrapper">
                  <FiUser className="input-search-icon" size={14} />
                  <input
                    type="text"
                    placeholder="Search Name..."
                    value={nameSearch}
                    onChange={handleNameSearchChange}
                    className="filter-input"
                  />
                </div>

                <div className="filter-input-wrapper">
                  <FiMail className="input-search-icon" size={14} />
                  <input
                    type="text"
                    placeholder="Search Email..."
                    value={emailSearch}
                    onChange={handleEmailSearchChange}
                    className="filter-input"
                  />
                </div>

                <div className="filter-select-wrapper">
                  <select
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                    className="filter-select"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>
                  <FiChevronDown className="select-arrow-icon" size={13} />
                </div>
              </div>

              {/* 5. SCROLLABLE DATA TABLE CONTAINER WITH STICKY HEADER */}
              {paginatedResults.length > 0 ? (
                <div className="table-responsive-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th className="col-index">#</th>
                        <th className="col-name">Name</th>
                        <th className="col-email">Email</th>
                        <th className="col-status">Status</th>
                        <th className="col-sentat">Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedResults.map((row, idx) => {
                        const globalIndex = startIndex + idx + 1;
                        const firstLetter = row.name ? row.name.charAt(0).toUpperCase() : '?';
                        const avatarBg = getAvatarColor(row.name);

                        return (
                          <tr key={idx}>
                            <td className="col-index font-secondary">{globalIndex}</td>
                            <td className="col-name">
                              <div className="name-cell-content">
                                <div className="avatar-circle" style={{ backgroundColor: avatarBg }}>
                                  {firstLetter}
                                </div>
                                <span className="name-text">{row.name}</span>
                              </div>
                            </td>
                            <td className="col-email font-secondary">{row.email}</td>
                            <td className="col-status">
                              <span
                                className={`badge ${
                                  row.status === 'Success' ? 'badge-success' : 'badge-failed'
                                }`}
                              >
                                {row.status === 'Success' ? (
                                  <>
                                    <FiCheckCircle size={11} style={{ marginRight: 3 }} /> Success
                                  </>
                                ) : (
                                  <>
                                    <FiXCircle size={11} style={{ marginRight: 3 }} /> Failed
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="col-sentat font-secondary">
                              {row.sentAt || sentTimestamp || 'Just now'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-data-msg">
                  No matching records found.
                </div>
              )}

              {/* 6. STRICT SINGLE-ROW PAGINATION TOOLBAR */}
              <div className="pagination-footer">
                <div className="rows-per-page-selector">
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    className="rows-select"
                  >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="pagination-info">
                  Showing {totalFiltered > 0 ? startIndex + 1 : 0} to {endIndex} of {totalFiltered} results
                </div>

                <div className="pagination-nav-btns">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={activePage <= 1}
                    className="btn-page-nav"
                  >
                    <FiChevronLeft size={13} style={{ marginRight: 2 }} /> Previous
                  </button>

                  <span className="active-page-pill">
                    {activePage}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={activePage >= totalPages}
                    className="btn-page-nav"
                  >
                    Next <FiChevronRight size={13} style={{ marginLeft: 2 }} />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
