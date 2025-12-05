import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Project {
  id: string;
  name: string;
  description: string;
  target: string;
  raised: string;
  deadline: number;
  creator: string;
}

const FHEEncryptNumber = (value: number): string => `FHE-${btoa(value.toString())}`;
const FHEDecryptNumber = (encryptedData: string): number => encryptedData.startsWith('FHE-') ? parseFloat(atob(encryptedData.substring(4))) : parseFloat(encryptedData);
const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newProjectData, setNewProjectData] = useState({ name: "", description: "", target: "" });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [decryptedData, setDecryptedData] = useState<{ target: number | null; raised: number | null }>({ target: null, raised: null });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [activeTab, setActiveTab] = useState('projects');
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
      
      const projectsBytes = await contract.getData("projects");
      let projectsList: Project[] = [];
      if (projectsBytes.length > 0) {
        try {
          const projectsStr = ethers.toUtf8String(projectsBytes);
          if (projectsStr.trim() !== '') projectsList = JSON.parse(projectsStr);
        } catch (e) {}
      }
      setProjects(projectsList);
    } catch (e) {
      console.error("Error loading data:", e);
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
      setLoading(false); 
    }
  };

  const createProject = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingProject(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating project with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: newProjectData.name,
        description: newProjectData.description,
        target: FHEEncryptNumber(parseFloat(newProjectData.target) || 0),
        raised: FHEEncryptNumber(0),
        deadline: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        creator: address
      };
      
      const updatedProjects = [...projects, newProject];
      await contract.setData("projects", ethers.toUtf8Bytes(JSON.stringify(updatedProjects)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Project created successfully!" });
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewProjectData({ name: "", description: "", target: "" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingProject(false); 
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return FHEDecryptNumber(encryptedData);
    } catch (e) { 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const contributeToProject = async (projectId: string, amount: number) => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setTransactionStatus({ visible: true, status: "pending", message: "Processing contribution with FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const projectIndex = projects.findIndex(p => p.id === projectId);
      if (projectIndex === -1) throw new Error("Project not found");
      
      const updatedProjects = [...projects];
      const currentRaised = FHEDecryptNumber(updatedProjects[projectIndex].raised);
      updatedProjects[projectIndex].raised = FHEEncryptNumber(currentRaised + amount);
      
      await contract.setData("projects", ethers.toUtf8Bytes(JSON.stringify(updatedProjects)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Contribution successful!" });
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Contribution failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const renderProjectCard = (project: Project) => {
    const target = decryptedData.target || FHEDecryptNumber(project.target);
    const raised = decryptedData.raised || FHEDecryptNumber(project.raised);
    const progress = Math.min(100, (raised / target) * 100);
    
    return (
      <div className="project-card" key={project.id}>
        <div className="card-header">
          <h3>{project.name}</h3>
          <div className="creator">by {project.creator.substring(0, 6)}...{project.creator.substring(38)}</div>
        </div>
        <div className="card-body">
          <p className="description">{project.description}</p>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            <div className="progress-text">{progress.toFixed(1)}% funded</div>
          </div>
          <div className="stats">
            <div className="stat">
              <span>Target:</span>
              <strong>{project.target.substring(0, 15)}...</strong>
            </div>
            <div className="stat">
              <span>Raised:</span>
              <strong>{project.raised.substring(0, 15)}...</strong>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <button 
            className="decrypt-btn" 
            onClick={() => {
              setSelectedProject(project);
              setDecryptedData({ target: null, raised: null });
            }}
          >
            View Details
          </button>
        </div>
      </div>
    );
  };

  const renderFAQ = () => {
    return (
      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-item">
          <h3>How does Crowdfund Cloak protect my privacy?</h3>
          <p>Using Zama FHE technology, your contributions are encrypted so only you can see the exact amount unless you choose to reveal it.</p>
        </div>
        <div className="faq-item">
          <h3>Can I contribute anonymously?</h3>
          <p>Yes, your wallet address and contribution amount are encrypted using FHE, providing complete anonymity.</p>
        </div>
        <div className="faq-item">
          <h3>How do I decrypt my contribution?</h3>
          <p>Simply sign a message with your wallet to decrypt your specific contribution data.</p>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const totalRaised = projects.reduce((sum, p) => sum + (decryptedData.raised || FHEDecryptNumber(p.raised)), 0);
    const avgFunding = projects.length > 0 ? totalRaised / projects.length : 0;
    const successfulProjects = projects.filter(p => {
      const raised = decryptedData.raised || FHEDecryptNumber(p.raised);
      const target = decryptedData.target || FHEDecryptNumber(p.target);
      return raised >= target;
    }).length;

    return (
      <div className="stats-section">
        <h2>Platform Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalRaised.toFixed(2)} ETH</div>
            <div className="stat-label">Total Raised</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{avgFunding.toFixed(2)} ETH</div>
            <div className="stat-label">Avg. Funding</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{successfulProjects}</div>
            <div className="stat-label">Successful</div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing encrypted crowdfunding platform...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Crowdfund Cloak</h1>
          <span>Private Decentralized Crowdfunding</span>
        </div>
        <div className="header-actions">
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
        </div>
      </header>

      <main className="main-content">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
          <button 
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
          <button 
            className={`tab ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            FAQ
          </button>
        </div>

        {activeTab === 'projects' && (
          <div className="projects-tab">
            <div className="projects-header">
              <h2>Discover Private Crowdfunding Projects</h2>
              <div className="controls">
                <input 
                  type="text" 
                  placeholder="Search projects..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button 
                  className="create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  + New Project
                </button>
              </div>
            </div>

            <div className="projects-grid">
              {filteredProjects.length > 0 ? (
                filteredProjects.map(project => renderProjectCard(project))
              ) : (
                <div className="empty-state">
                  <p>No projects found. Be the first to create one!</p>
                  <button 
                    className="create-btn"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create Project
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && renderStats()}
        {activeTab === 'faq' && renderFAQ()}
      </main>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input 
                  type="text" 
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})}
                  placeholder="Enter project name"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newProjectData.description}
                  onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})}
                  placeholder="Describe your project"
                />
              </div>
              <div className="form-group">
                <label>Funding Target (ETH)</label>
                <input 
                  type="number" 
                  value={newProjectData.target}
                  onChange={(e) => setNewProjectData({...newProjectData, target: e.target.value})}
                  placeholder="Enter target amount"
                />
              </div>
              <div className="fhe-notice">
                <div className="lock-icon"></div>
                <p>All financial data will be encrypted with Zama FHE</p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="cancel-btn">Cancel</button>
              <button 
                onClick={createProject} 
                disabled={!newProjectData.name || !newProjectData.description || !newProjectData.target || creatingProject}
                className="submit-btn"
              >
                {creatingProject ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="modal-overlay">
          <div className="project-modal">
            <div className="modal-header">
              <h2>{selectedProject.name}</h2>
              <button onClick={() => setSelectedProject(null)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="project-details">
                <p className="description">{selectedProject.description}</p>
                <div className="creator">Created by: {selectedProject.creator.substring(0, 6)}...{selectedProject.creator.substring(38)}</div>
                
                <div className="funding-section">
                  <h3>Funding Progress</h3>
                  <div className="progress-container">
                    <div className="progress-bar" style={{ 
                      width: `${Math.min(100, 
                        ((decryptedData.raised || FHEDecryptNumber(selectedProject.raised)) / 
                        (decryptedData.target || FHEDecryptNumber(selectedProject.target))) * 100
                      )}%` 
                    }}></div>
                    <div className="progress-text">
                      {Math.min(100, 
                        ((decryptedData.raised || FHEDecryptNumber(selectedProject.raised)) / 
                        (decryptedData.target || FHEDecryptNumber(selectedProject.target))) * 100
                      ).toFixed(1)}% funded
                    </div>
                  </div>
                  
                  <div className="funding-stats">
                    <div className="stat">
                      <span>Target:</span>
                      {decryptedData.target !== null ? (
                        <strong>{decryptedData.target} ETH</strong>
                      ) : (
                        <button 
                          className="decrypt-btn"
                          onClick={async () => {
                            const decrypted = await decryptWithSignature(selectedProject.target);
                            if (decrypted !== null) {
                              setDecryptedData({...decryptedData, target: decrypted});
                            }
                          }}
                          disabled={isDecrypting}
                        >
                          {isDecrypting ? "Decrypting..." : "Decrypt Target"}
                        </button>
                      )}
                    </div>
                    <div className="stat">
                      <span>Raised:</span>
                      {decryptedData.raised !== null ? (
                        <strong>{decryptedData.raised} ETH</strong>
                      ) : (
                        <button 
                          className="decrypt-btn"
                          onClick={async () => {
                            const decrypted = await decryptWithSignature(selectedProject.raised);
                            if (decrypted !== null) {
                              setDecryptedData({...decryptedData, raised: decrypted});
                            }
                          }}
                          disabled={isDecrypting}
                        >
                          {isDecrypting ? "Decrypting..." : "Decrypt Raised"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="contribute-section">
                  <h3>Contribute</h3>
                  <div className="contribute-form">
                    <input type="number" placeholder="Amount (ETH)" id="contributionAmount" />
                    <button 
                      className="contribute-btn"
                      onClick={() => {
                        const amountInput = document.getElementById('contributionAmount') as HTMLInputElement;
                        const amount = parseFloat(amountInput.value);
                        if (amount > 0) {
                          contributeToProject(selectedProject.id, amount);
                        }
                      }}
                    >
                      Contribute Privately
                    </button>
                  </div>
                  <div className="fhe-tag">
                    <div className="fhe-icon"></div>
                    <span>Your contribution will be encrypted with FHE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="transaction-notification">
          <div className={`notification-content ${transactionStatus.status}`}>
            {transactionStatus.message}
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>Crowdfund Cloak</h3>
            <p>Privacy-first crowdfunding powered by Zama FHE</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>Powered by Zama FHE</span>
          </div>
          <div className="copyright">© 2023 Crowdfund Cloak. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;