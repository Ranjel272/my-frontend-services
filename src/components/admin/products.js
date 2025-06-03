import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/products.css"; // Ensure this CSS path is correct relative to this file
import Sidebar from "../sidebar"; // Ensure this path is correct
import { FaChevronDown, FaBell } from "react-icons/fa";
import DataTable from "react-data-table-component";
import { DEFAULT_PROFILE_IMAGE } from "./employeeRecords"; // Ensure this path and export are correct

const API_BASE_URL = "http://127.0.0.1:9001"; // POS Backend URL

const currentDate = new Date().toLocaleString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function Products() {
  const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({
    role: "User",
    name: "Current User",
  });
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(null);
  const [productTypes, setProductTypes] = useState([]);
  const [productsByType, setProductsByType] = useState({});
  const [filterStates, setFilterStates] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const getAuthToken = () => {
    return localStorage.getItem("access_token");
  };

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      try {
        const decodedToken = JSON.parse(atob(token.split(".")[1]));
        setLoggedInUserDisplay({
          name: decodedToken.sub || "Current User",
          role: decodedToken.role || "User",
        });
      } catch (error) {
        console.error("Error decoding token for display:", error);
        // Optionally, handle bad token by logging out
        // localStorage.removeItem("access_token");
        // navigate("/");
      }
    } else {
      navigate("/"); // Redirect to login if no token
    }
  }, [navigate]);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      const token = getAuthToken();

      if (!token) {
        setError("Authentication token not found. Please log in.");
        setIsLoading(false);
        navigate("/");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/Products/products/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setError("Unauthorized or Forbidden. Please log in again.");
            localStorage.removeItem("access_token"); // Clear bad token
            navigate("/");
          } else {
            const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.detail || "Failed to fetch products"}`);
          }
          return; 
        }

        const allProductsFromBackend = await response.json();
        const PTypesCollector = {};
        const PByTypeCollector = {};
        const initialFilterStatesCollector = {};

        allProductsFromBackend.forEach((product) => {
          const {
              ProductID,
              ProductName,
              ProductTypeName,
              ProductCategory,
              ProductDescription,
              ProductPrice,
              ProductImage, // Expected from backend: "/static/pos_product_images/image.jpg" or null
              ProductSizes
          } = product;

          PTypesCollector[ProductTypeName] = true;

          if (!PByTypeCollector[ProductTypeName]) {
            PByTypeCollector[ProductTypeName] = [];
            initialFilterStatesCollector[ProductTypeName] = {
              search: "",
              category: "",
            };
            if (ProductTypeName === "Drink") {
              initialFilterStatesCollector[ProductTypeName].specificType = "";
              initialFilterStatesCollector[ProductTypeName].specificSize = "";
            }
          }

          // --- MODIFIED SECTION FOR ProductImage URL ---
          let processedImageURL = null;
          if (ProductImage && typeof ProductImage === 'string' && ProductImage.trim() !== '') {
            if (ProductImage.startsWith('http') || ProductImage.startsWith('data:')) {
              // It's already a full URL (e.g., from an external CDN or a data URI)
              processedImageURL = ProductImage;
            } else {
              // ProductImage from backend is expected to be a path relative to the API server root,
              // e.g., "/static/pos_product_images/my_drink.jpg".
              // Construct the full URL by joining API_BASE_URL and ProductImage.
              try {
                // new URL(path, base) correctly handles joining, including existing slashes.
                processedImageURL = new URL(ProductImage, API_BASE_URL).href;
                // Example:
                // API_BASE_URL = "http://127.0.0.1:9001"
                // ProductImage = "/static/pos_product_images/my_drink.jpg" (from backend)
                // Result: "http://127.0.0.1:9001/static/pos_product_images/my_drink.jpg"
              } catch (e) {
                console.error(
                  "Error constructing image URL. ProductImage might be an unexpected format.",
                  "ProductImage:", ProductImage,
                  "API_BASE_URL:", API_BASE_URL,
                  "Error:", e
                );
                // Fallback if URL construction fails
                processedImageURL = DEFAULT_PROFILE_IMAGE;
              }
            }
          } else {
            // Use default placeholder if no image or empty/null string
            processedImageURL = DEFAULT_PROFILE_IMAGE; 
          }
          // --- END OF MODIFIED SECTION ---

          const frontendProduct = {
            id: ProductID,
            name: ProductName || "Unknown Product",
            description: ProductDescription || "N/A",
            category: ProductCategory || "N/A",
            productTypeName: ProductTypeName,
            price: ProductPrice !== undefined && ProductPrice !== null
                   ? (String(ProductPrice).startsWith('₱') ? String(ProductPrice) : `₱${parseFloat(ProductPrice).toFixed(2)}`)
                   : "N/A",
            image: processedImageURL, // Use the correctly processed URL
            types: ProductTypeName === "Drink" ? "N/A" : undefined, 
            sizes: (ProductSizes && Array.isArray(ProductSizes) && ProductSizes.length > 0)
                   ? ProductSizes.join(", ")
                   : "N/A",
            _rawSizesList: ProductSizes || [],
          };
          PByTypeCollector[ProductTypeName].push(frontendProduct);
        });

        const uniquePTypes = Object.keys(PTypesCollector).sort();
        setProductTypes(uniquePTypes);
        setProductsByType(PByTypeCollector);
        setFilterStates(initialFilterStatesCollector);

        if (uniquePTypes.length > 0 && (activeTab === null || !uniquePTypes.includes(activeTab))) {
          setActiveTab(uniquePTypes[0]);
        } else if (uniquePTypes.length === 0) {
          setActiveTab(null);
        }

      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError(err.message || "Failed to fetch products. Check console for details.");
      } finally {
        setIsLoading(false);
      }
    };

    if (getAuthToken()) { 
        fetchProducts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]); // Removed activeTab from dependencies; fetch on mount or when token changes (via navigate)

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setLoggedInUserDisplay({ role: "User", name: "Current User" }); 
    setDropdownOpen(false);
    navigate("/");
  };

  const handleFilterChange = (typeName, filterKey, value) => {
    setFilterStates(prev => ({
      ...prev,
      [typeName]: {
        ...(prev[typeName] || {}),
        [filterKey]: value,
      }
    }));
  };

  const getUniqueValues = (products, key) => {
    if (!products || products.length === 0) return [];
    return [...new Set(products.map(p => p[key]).filter(Boolean).filter(val => val !== "N/A"))].sort();
  };

  const getUniqueIndividualSizesFromProductList = (products, rawSizeListKey = '_rawSizesList') => {
    if (!products || products.length === 0) return [];
    const allIndividualValues = new Set();
    products.forEach(p => {
      const sizesList = p[rawSizeListKey];
      if (sizesList && Array.isArray(sizesList)) {
        sizesList.forEach(val => {
          const trimmedVal = String(val).trim();
          if (trimmedVal) {
            allIndividualValues.add(trimmedVal);
          }
        });
      }
    });
    return [...allIndividualValues].sort();
  };

  const getUniqueCategoriesForType = (typeName) => getUniqueValues(productsByType[typeName], 'category');
  const getUniqueSpecificTypesForDrink = (typeName) => typeName === "Drink" ? getUniqueValues(productsByType[typeName], 'types') : [];
  const getUniqueSpecificSizesForDrink = (typeName) => {
    if (typeName === "Drink" && productsByType[typeName]) {
      return getUniqueIndividualSizesFromProductList(productsByType[typeName], '_rawSizesList');
    }
    return [];
  };

  const filteredProductsForActiveTab = useMemo(() => {
    if (!activeTab || !productsByType[activeTab] || !filterStates[activeTab]) {
      return [];
    }
    const currentProducts = productsByType[activeTab];
    const currentFilters = filterStates[activeTab];

    return currentProducts.filter(item => {
      const searchLower = (currentFilters.search || "").toLowerCase();
      const searchMatch = item.name.toLowerCase().includes(searchLower) ||
                          (item.description && item.description.toLowerCase().includes(searchLower));
      const categoryMatch = !currentFilters.category || item.category === currentFilters.category;

      let specificTypeMatch = true;
      let specificSizeMatch = true;

      if (activeTab === "Drink" && currentFilters) {
        specificTypeMatch = !currentFilters.specificType || item.types === currentFilters.specificType;

        if (currentFilters.specificSize) {
          if (item._rawSizesList && item._rawSizesList.length > 0) {
            specificSizeMatch = item._rawSizesList.map(s => String(s).trim()).includes(String(currentFilters.specificSize).trim());
          } else {
            specificSizeMatch = false;
          }
        }
      }
      return searchMatch && categoryMatch && specificTypeMatch && specificSizeMatch;
    });
  }, [activeTab, productsByType, filterStates]);

  const getColumnsForProductType = (typeName) => {
    const columns = [
      {
        name: "PRODUCT",
        selector: (row) => row.name,
        cell: (row) => (
          <div className="product-info-cell">
            <img
              src={row.image} 
              alt={row.name}
              className="product-photo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = DEFAULT_PROFILE_IMAGE; 
              }}
            />
            <div className="product-name-in-table">{row.name}</div>
          </div>
        ),
        sortable: true,
        minWidth: "250px",
        grow: 2.5,
      },
      { name: "DESCRIPTION", selector: (row) => row.description, wrap: true, minWidth: "300px", grow: 3 },
      { name: "CATEGORY", selector: (row) => row.category, center: true, sortable: true, minWidth: "150px", grow: 1.5 },
    ];

    if (typeName === "Drink") {
      columns.push({
        name: "TYPES", 
        selector: (row) => row.types,
        center: true,
        minWidth: "120px",
        grow: 1
      });
    }

    columns.push({
        name: "SIZES",
        selector: (row) => row.sizes, 
        cell: (row) => <div style={{ whiteSpace: 'pre-wrap', textAlign: 'center' }}>{row.sizes}</div>,
        center: true,
        minWidth: "150px",
        grow: 1.5,
    });

    columns.push({
        name: "PRICE",
        selector: (row) => row.price,
        center: true,
        sortable: true,
        minWidth: "100px",
        grow: 1,
    });

    return columns;
  };

  if (isLoading) {
    return (
      <div className="productList-page">
        <Sidebar />
        <div className="products-main-container">
          <header className="header">
            <div className="header-left"><h2 className="page-title">Products</h2></div>
          </header>
          <div className="loading-container">Loading products...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="productList-page">
        <Sidebar />
        <div className="products-main-container">
           <header className="header">
            <div className="header-left"><h2 className="page-title">Products</h2></div>
          </header>
          <div className="error-container">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="productList-page">
      <Sidebar />
      <div className="products-main-container">
        <header className="header">
          <div className="header-left">
            <h2 className="page-title">Products</h2>
          </div>
          <div className="header-right">
            <div className="header-date">{currentDate}</div>
            <div className="header-profile-container">
              <div className="profile-details-left">
                <div
                  className="profile-pic-header"
                  style={{ backgroundImage: `url(${DEFAULT_PROFILE_IMAGE})` }} 
                ></div>
                <div className="profile-info-header">
                  <div className="profile-role-header">
                    Hi! I'm {loggedInUserDisplay.role}
                  </div>
                  <div className="profile-name-header">{loggedInUserDisplay.name}</div>
                </div>
              </div>
              <div className="profile-actions-right">
                <div className="dropdown-icon-header" onClick={toggleDropdown}>
                  <FaChevronDown />
                </div>
                <div className="bell-icon-header">
                  <FaBell className="bell-outline" />
                </div>
              </div>
              {isDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <ul>
                    <li onClick={handleLogout}>Logout</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="products-content-area">
          <div className="product-tabs-container">
            {productTypes.map((typeName) => (
              <button
                key={typeName}
                className={`tab-button ${activeTab === typeName ? "active-tab-button" : ""}`}
                onClick={() => setActiveTab(typeName)}
              >
                {typeName}
              </button>
            ))}
            {productTypes.length === 0 && !isLoading && <div className="no-data-message">No product types found.</div>}
          </div>

          <div className="product-tab-content-area">
            {activeTab && productsByType[activeTab] && filterStates[activeTab] && (
              <div className={`${activeTab.toLowerCase().replace(/\s+/g, '-')}-products-view`}>
                <div className="filter-bar-container">
                  <input
                    type="text"
                    className="filter-search-input"
                    placeholder={`Search in ${activeTab}...`}
                    value={filterStates[activeTab]?.search || ""}
                    onChange={(e) => handleFilterChange(activeTab, "search", e.target.value)}
                  />
                  <select
                    className="filter-select"
                    value={filterStates[activeTab]?.category || ""}
                    onChange={(e) => handleFilterChange(activeTab, "category", e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {getUniqueCategoriesForType(activeTab).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {activeTab === "Drink" && (
                    <>
                      <select
                        className="filter-select"
                        value={filterStates[activeTab]?.specificType || ""}
                        onChange={(e) => handleFilterChange(activeTab, "specificType", e.target.value)}
                      >
                        <option value="">All Types</option>
                         {getUniqueSpecificTypesForDrink(activeTab).map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <select
                        className="filter-select"
                        value={filterStates[activeTab]?.specificSize || ""}
                        onChange={(e) => handleFilterChange(activeTab, "specificSize", e.target.value)}
                      >
                        <option value="">All Sizes</option>
                        {getUniqueSpecificSizesForDrink(activeTab).map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                <DataTable
                  columns={getColumnsForProductType(activeTab)}
                  data={filteredProductsForActiveTab}
                  striped
                  highlightOnHover
                  responsive
                  pagination
                  paginationPerPage={10}
                  paginationRowsPerPageOptions={[10, 20, 30, 50]}
                  noDataComponent={<div className="no-data-message">No products found matching your criteria for {activeTab}.</div>}
                  customStyles={{
                    headCells: {
                      style: {
                        backgroundColor: "#4B929D",
                        color: "#FFFFFF",
                        fontWeight: "bold",
                        fontSize: "0.875rem",
                        padding: "12px 16px",
                        textTransform: "uppercase",
                        textAlign: "center",
                      },
                    },
                    cells: {
                        style: {
                            padding: '10px 16px',
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            verticalAlign: 'middle', 
                        },
                    },
                    rows: {
                      style: {
                        minHeight: "70px", 
                        borderBottomColor: "#DDDDDD",
                      },
                      highlightOnHoverStyle: {
                        backgroundColor: "#f0f8ff", 
                        color: "#222222",
                        transitionDuration: "0.15s",
                        transitionProperty: "background-color",
                      },
                    },
                    pagination: {
                        style: {
                            borderTopStyle: 'solid',
                            borderTopWidth: '1px',
                            borderTopColor: "#DDDDDD",
                            padding: '10px',
                        },
                        pageButtonsStyle: {
                            borderRadius: '50%',
                            height: '40px',
                            width: '40px',
                            padding: '8px',
                            margin: '0px',
                            cursor: 'pointer',
                            transition: '0.4s',
                            color: '#333333',
                            fill: '#333333',
                            '&:disabled': {
                                cursor: 'unset',
                                color: '#BBBBBB',
                                fill: '#BBBBBB',
                            },
                            '&:hover:not(:disabled)': {
                                backgroundColor: '#e0e0e0',
                            },
                            '&:focus': {
                                outline: 'none',
                                backgroundColor: '#c0c0c0',
                            },
                        },
                    },
                  }}
                />
              </div>
            )}
            {!activeTab && productTypes.length > 0 && <div className="no-data-message">Please select a product type to view items.</div>}
            {!activeTab && productTypes.length === 0 && !isLoading && <div className="no-data-message">No products available to display.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;