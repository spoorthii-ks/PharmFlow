import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface Medicine {
  id: number;
  name: string;
  quantity: number;
  min_stock: number;
  expiry_date: string;
  days_left: number;
  status: string;
}

export default function Dashboard() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formQty, setFormQty] = useState(0);
  const [formMin, setFormMin] = useState(10);
  const [formExpiry, setFormExpiry] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("pharmaflow_user") || "null");
    if (!currentUser) {
      navigate("/");
      return;
    }
    fetchMedicines();
  }, [navigate]);

  const fetchMedicines = async () => {
    try {
      const token = localStorage.getItem("pharmaflow_token");
      const response = await fetch('/api/medicines', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMedicines(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to fetch medicines:", err);
    }
  };

  const stats = useMemo(() => {
    let total = 0, instock = 0, low = 0, expired = 0;
    medicines.forEach(med => {
      total++;
      if (med.status === "In Stock") instock++;
      else if (med.status === "Low" || med.status === "Critical") low++;
      else if (med.status === "Expired") expired++;
    });
    return { total, instock, low, expired };
  }, [medicines]);

  const filteredMedicines = useMemo(() => {
    return medicines.filter(med => {
      const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = statusFilter === "All" || med.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [medicines, searchQuery, statusFilter]);

  const reorderItems = useMemo(() => {
    return medicines
      .filter(med => med.status !== "In Stock")
      .sort((a, b) => {
        const val: Record<string, number> = { "Expired": 1, "Critical": 2, "Low": 3 };
        return val[a.status] - val[b.status];
      });
  }, [medicines]);

  const handleLogout = () => {
    localStorage.removeItem("pharmaflow_user");
    localStorage.removeItem("pharmaflow_token");
    navigate("/");
  };

  const openModal = (med: Medicine | null = null) => {
    if (med) {
      setEditingMed(med);
      setFormName(med.name);
      setFormQty(med.quantity);
      setFormMin(med.min_stock);
      setFormExpiry(new Date(med.expiry_date).toISOString().split('T')[0]);
    } else {
      setEditingMed(null);
      setFormName('');
      setFormQty(0);
      setFormMin(10);
      setFormExpiry(new Date().toISOString().split('T')[0]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMed(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("pharmaflow_token");
    const url = editingMed ? `/api/medicines/${editingMed.id}` : '/api/medicines';
    const method = editingMed ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formName,
          quantity: formQty,
          min_stock: formMin,
          expiry_date: formExpiry
        })
      });

      if (response.ok) {
        fetchMedicines();
        closeModal();
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to save medicine:", err);
    }
  };

  const deleteMedicine = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this medicine?")) {
      const token = localStorage.getItem("pharmaflow_token");
      try {
        const response = await fetch(`/api/medicines/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          fetchMedicines();
        } else if (response.status === 401) {
          handleLogout();
        }
      } catch (err) {
        console.error("Failed to delete medicine:", err);
      }
    }
  };

  return (
    <div className="dashboard-page-wrapper">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>PharmaFlow</h2>
        </div>
        <ul className="sidebar-nav">
          <li className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <span className="icon">📊</span> Dashboard
          </li>
          <li className={activeTab === 'medicines' ? 'active' : ''} onClick={() => setActiveTab('medicines')}>
            <span className="icon">💊</span> Medicines
          </li>
          <li className={activeTab === 'alerts' ? 'active' : ''} onClick={() => setActiveTab('alerts')}>
            <span className="icon">⚠️</span> Alerts / Reorder
          </li>
          <li className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
            <span className="icon">⚙️</span> Settings
          </li>
        </ul>
        <div className="sidebar-footer">
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
            <span className="icon">🚪</span> Logout
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <h1>{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'medicines' ? 'Medicines' : activeTab === 'alerts' ? 'Alerts / Reorder' : 'Settings'}</h1>
          <button className="btn-primary" onClick={() => openModal()}>+ Add Medicine</button>
        </header>

        {activeTab !== 'settings' && (
          <>
            {activeTab === 'dashboard' && (
              <section className="summary-cards">
                <div className="card stat-card bg-blue">
                  <h3>Total Medicines</h3>
                  <p>{stats.total}</p>
                </div>
                <div className="card stat-card bg-green">
                  <h3>In Stock</h3>
                  <p>{stats.instock}</p>
                </div>
                <div className="card stat-card bg-yellow">
                  <h3>Low/Critical Stock</h3>
                  <p>{stats.low}</p>
                </div>
                <div className="card stat-card bg-red">
                  <h3>Expired</h3>
                  <p>{stats.expired}</p>
                </div>
              </section>
            )}

            <div className="dashboard-layout">
              {(activeTab === 'dashboard' || activeTab === 'medicines') && (
                <div className="left-panel">
                  <div className="card table-container">
                    <div className="table-header">
                      <div className="search-wrap">
                        <input 
                          type="text" 
                          placeholder="Search medicines..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="filter-wrap">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                          <option value="All">All</option>
                          <option value="In Stock">In Stock</option>
                          <option value="Low">Low</option>
                          <option value="Critical">Critical</option>
                          <option value="Expired">Expired</option>
                        </select>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="medicine-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Quantity</th>
                            <th>Expiry Date</th>
                            <th>Days Left</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMedicines.map(med => {
                            let badgeClass = "badge-instock";
                            if (med.status === "Low") badgeClass = "badge-low";
                            if (med.status === "Critical") badgeClass = "badge-critical";
                            if (med.status === "Expired") badgeClass = "badge-expired";
                            
                            return (
                              <tr key={med.id}>
                                <td><strong>{med.name}</strong></td>
                                <td>{med.quantity}</td>
                                <td>{new Date(med.expiry_date).toLocaleDateString()}</td>
                                <td>{med.days_left < 0 ? 'Expired' : `${med.days_left} days`}</td>
                                <td><span className={`badge ${badgeClass}`}>{med.status}</span></td>
                                <td className="action-btns">
                                  <button className="btn-icon edit-btn" onClick={() => openModal(med)} title="Edit">✎</button>
                                  <button className="btn-icon delete-btn" onClick={() => deleteMedicine(med.id)} title="Delete">🗑</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {(activeTab === 'dashboard' || activeTab === 'alerts') && (
                <div className="right-panel">
                  <div className="card reorder-container">
                    <h2>Reorder Needed</h2>
                    <ul className="reorder-list">
                      {reorderItems.length === 0 ? (
                        <li style={{ color: '#999', justifyContent: 'center' }}>No items need reordering.</li>
                      ) : (
                        reorderItems.map(item => {
                          let badgeClass = item.status === "Low" ? "badge-low" : (item.status === "Critical" ? "badge-critical" : "badge-expired");
                          return (
                            <li key={item.id}>
                              <div className="reorder-info">
                                <span className="reorder-name">{item.name}</span>
                                <span className="reorder-qty">Qty: {item.quantity} / Min: {item.min_stock}</span>
                              </div>
                              <span className={`badge ${badgeClass}`}>{item.status}</span>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div style={{ padding: '40px' }}>
            <div className="card">
              <h2>Settings</h2>
              <p style={{ marginTop: '15px', color: 'var(--text-muted)' }}>Application settings configuration will go here.</p>
              <br />
              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label>Pharmacy Name</label>
                <input type="text" defaultValue="PharmaFlow Demo" />
              </div>
              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label>Default Alert Threshold (Days)</label>
                <input type="number" defaultValue="30" />
              </div>
              <button className="btn-primary" style={{ maxWidth: '150px' }}>Save Settings</button>
            </div>
          </div>
        )}
      </main>

      {/* Modal for Add/Edit Medicine */}
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content card">
            <h2 id="modal-title">{editingMed ? 'Edit Medicine' : 'Add Medicine'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  required 
                  placeholder="e.g. Paracetamol" 
                />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input 
                  type="number" 
                  value={formQty} 
                  onChange={(e) => setFormQty(parseInt(e.target.value))} 
                  required 
                  min="0" 
                  placeholder="e.g. 50" 
                />
              </div>
              <div className="form-group">
                <label>Minimum Stock</label>
                <input 
                  type="number" 
                  value={formMin} 
                  onChange={(e) => setFormMin(parseInt(e.target.value))} 
                  required 
                  min="1" 
                  placeholder="e.g. 10" 
                />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input 
                  type="date" 
                  value={formExpiry} 
                  onChange={(e) => setFormExpiry(e.target.value)} 
                  required 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
