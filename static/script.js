// SQLite 데이터베이스 관리
let db = null;

// 데이터베이스 초기화 (백엔드 사용하므로 클라이언트 DB는 비활성화)
async function initDatabase() {
    try {
        // 백엔드 API를 사용하므로 클라이언트 사이드 SQL.js는 비활성화
        console.log('백엔드 API를 사용합니다. 클라이언트 DB 초기화를 건너뜁니다.');
        return;
        
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // 로컬 스토리지에서 기존 데이터베이스 불러오기 또는 새로 생성
        const savedDb = localStorage.getItem('estimateDatabase');
        if (savedDb) {
            const uintArray = new Uint8Array(JSON.parse(savedDb));
            db = new SQL.Database(uintArray);
        } else {
            db = new SQL.Database();
            createTables();
        }
    } catch (error) {
        console.warn('클라이언트 DB 초기화 실패, 백엔드 API 사용:', error);
    }
}

// 테이블 생성
function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            business_number TEXT,
            address TEXT,
            ceo TEXT,
            type TEXT,
            item TEXT,
            phone TEXT,
            fax TEXT,
            manager TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            business_number TEXT,
            address TEXT,
            ceo TEXT,
            phone TEXT,
            manager TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_holder TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            estimate_number TEXT,
            estimate_date DATE,
            valid_until DATE,
            company_id INTEGER,
            client_id INTEGER,
            bank_id INTEGER,
            subtotal REAL,
            tax REAL,
            total REAL,
            items TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies (id),
            FOREIGN KEY (client_id) REFERENCES clients (id),
            FOREIGN KEY (bank_id) REFERENCES bank_accounts (id)
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS daily_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE,
            site_name TEXT,
            items TEXT,
            total REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    saveDatabase();
}

// 데이터베이스 저장
function saveDatabase() {
    if (db) {
        const data = db.export();
        localStorage.setItem('estimateDatabase', JSON.stringify(Array.from(data)));
    }
}

// 회사 정보 저장 (데이터베이스)
async function saveCompanyToDB() {
    const companyData = {
        name: document.getElementById('company-name').value,
        business_number: document.getElementById('business-number').value,
        address: document.getElementById('company-address').value,
        ceo: document.getElementById('company-ceo').value,
        type: document.getElementById('company-type').value,
        item: document.getElementById('company-item').value,
        phone: document.getElementById('company-phone').value,
        fax: document.getElementById('company-fax').value,
        manager: document.getElementById('company-manager').value
    };
    
    if (!companyData.name) {
        alert('상호명을 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch('/api/companies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(companyData)
        });
        
        if (!response.ok) {
            throw new Error(`저장 실패: ${response.status}`);
        }
        
        const result = await response.json();
        alert(result.message || '회사 정보가 데이터베이스에 저장되었습니다.');
        
        // 드롭다운 새로고침
        await loadCompanyDropdown();
        
    } catch (error) {
        console.error('Company save error:', error);
        alert('회사 정보 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 선택된 레코드 저장 변수
let selectedRecord = null;
let selectedDataType = null;
let selectedRecords = new Set(); // 다중 선택용

// 데이터베이스 레코드 조회 (백엔드 API 사용)
async function loadDatabaseRecords() {
    console.log('데이터베이스 레코드 조회 시작');
    
    const dataType = document.getElementById('data-type-filter').value;
    const table = document.getElementById('records-table');
    const header = document.getElementById('records-header');
    const body = document.getElementById('records-body');
    const actions = document.getElementById('record-actions');
    
    // 테이블 초기화
    header.innerHTML = '';
    body.innerHTML = '';
    selectedRecord = null;
    selectedDataType = dataType;
    selectedRecords.clear();
    updateSelectionInfo();
    
    try {
        let apiUrl = '';
        let headers = ['체크박스'];
        
        switch (dataType) {
            case 'companies':
                apiUrl = '/api/companies';
                headers = headers.concat(['ID', '회사명', '등록번호', '주소', '대표자', '업태', '종목', '전화번호', '팩스', '담당자']);
                break;
            case 'clients':
                apiUrl = '/api/clients';
                headers = headers.concat(['ID', '유형', '고객명', '등록번호', '주소', '대표자', '전화번호', '담당자']);
                break;
            case 'estimates':
                apiUrl = '/api/estimates';
                headers = headers.concat(['ID', '견적번호', '견적일자', '회사명', '고객명', '총액', '등록일']);
                break;
            case 'daily_records':
                apiUrl = '/api/daily_records';
                headers = headers.concat(['ID', '일자', '현장명', '총액', '등록일']);
                break;
        }
        
        // 헤더 생성
        headers.forEach((headerText, index) => {
            const th = document.createElement('th');
            if (index === 0) {
                th.className = 'checkbox-column';
            }
            th.textContent = headerText;
            header.appendChild(th);
        });
        
        // 백엔드 API 호출
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status}`);
        }
        
        const records = await response.json();
        console.log('조회된 레코드:', records);
        
        // 레코드 데이터를 테이블에 추가
        records.forEach(record => {
            const tr = document.createElement('tr');
            
            // 체크박스 추가
            const selectTd = document.createElement('td');
            selectTd.className = 'checkbox-column';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'record-checkbox';
            checkbox.value = JSON.stringify(record);
            checkbox.onchange = function() {
                const recordData = JSON.parse(this.value);
                if (this.checked) {
                    selectedRecords.add(this.value);
                    selectedRecord = recordData; // 단일 선택도 유지
                    this.closest('tr').classList.add('selected');
                } else {
                    selectedRecords.delete(this.value);
                    this.closest('tr').classList.remove('selected');
                    // 마지막으로 선택된 것이 해제되면 selectedRecord도 null
                    if (selectedRecord && JSON.stringify(selectedRecord) === this.value) {
                        selectedRecord = null;
                    }
                }
                updateSelectionInfo();
            };
            selectTd.appendChild(checkbox);
            tr.appendChild(selectTd);
            
            // 데이터 셀 추가 (created_at 제외)
            Object.entries(record).forEach(([key, value]) => {
                if (key !== 'created_at' || dataType === 'estimates' || dataType === 'daily_records') {
                    const td = document.createElement('td');
                    // 날짜 형식 포맷팅
                    if (key.includes('date') || key.includes('created_at')) {
                        const date = new Date(value);
                        td.textContent = date.toLocaleDateString('ko-KR');
                    } else if (key.includes('amount') && typeof value === 'number') {
                        // 금액 형식 포맷팅
                        td.textContent = value.toLocaleString('ko-KR') + '원';
                    } else {
                        td.textContent = value || '';
                    }
                    tr.appendChild(td);
                }
            });
            
            body.appendChild(tr);
        });
        
        table.style.display = 'table';
        actions.style.display = 'block';
        document.getElementById('bulk-actions').style.display = 'block';
        
        if (records.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = headers.length;
            td.textContent = '저장된 데이터가 없습니다.';
            td.style.textAlign = 'center';
            tr.appendChild(td);
            body.appendChild(tr);
        }
        
    } catch (error) {
        console.error('API 조회 오류:', error);
        alert('데이터 조회 중 오류가 발생했습니다: ' + error.message);
    }
}

// 선택 정보 업데이트
function updateSelectionInfo() {
    const selectedCount = selectedRecords.size;
    document.getElementById('selection-count').textContent = `${selectedCount}개 선택됨`;
    
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    bulkDeleteBtn.disabled = selectedCount === 0;
    
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const allCheckboxes = document.querySelectorAll('.record-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.record-checkbox:checked');
    
    if (checkedCheckboxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedCheckboxes.length === allCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
        selectAllCheckbox.checked = false;
    }
}

// 전체 선택/해제
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const checkboxes = document.querySelectorAll('.record-checkbox');
    
    selectedRecords.clear();
    selectedRecord = null;
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const tr = checkbox.closest('tr');
        
        if (selectAllCheckbox.checked) {
            selectedRecords.add(checkbox.value);
            tr.classList.add('selected');
            if (!selectedRecord) {
                selectedRecord = JSON.parse(checkbox.value);
            }
        } else {
            tr.classList.remove('selected');
        }
    });
    
    updateSelectionInfo();
}

// 일괄 삭제
async function bulkDeleteRecords() {
    if (selectedRecords.size === 0) {
        alert('삭제할 항목을 선택해주세요.');
        return;
    }
    
    const confirmMessage = `선택한 ${selectedRecords.size}개의 항목을 삭제하시겠습니까?`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const dataType = document.getElementById('data-type-filter').value;
    let apiUrlBase = '';
    
    switch (dataType) {
        case 'companies':
            apiUrlBase = '/api/companies';
            break;
        case 'clients':
            apiUrlBase = '/api/clients';
            break;
        case 'estimates':
            apiUrlBase = '/api/estimates';
            break;
        case 'daily_records':
            apiUrlBase = '/api/daily_records';
            break;
        default:
            alert('데이터 유형이 선택되지 않았습니다.');
            return;
    }
    
    try {
        const deletePromises = [];
        
        selectedRecords.forEach(recordValue => {
            const record = JSON.parse(recordValue);
            const deleteUrl = `${apiUrlBase}/${record.id}`;
            deletePromises.push(fetch(deleteUrl, { method: 'DELETE' }));
        });
        
        const responses = await Promise.all(deletePromises);
        
        let successCount = 0;
        let errorCount = 0;
        
        responses.forEach(response => {
            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        });
        
        if (errorCount > 0) {
            alert(`${successCount}개 항목은 삭제되었지만, ${errorCount}개 항목 삭제 중 오류가 발생했습니다.`);
        } else {
            alert(`${successCount}개 항목이 성공적으로 삭제되었습니다.`);
        }
        
        // 테이블 새로고침
        await loadDatabaseRecords();
        
    } catch (error) {
        console.error('Bulk delete error:', error);
        alert('일괄 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 선택한 레코드 불러오기
function loadSelectedRecord() {
    if (!selectedRecord || !selectedDataType) {
        alert('불러올 데이터를 선택해주세요.');
        return;
    }
    
    try {
        switch (selectedDataType) {
            case 'companies':
                loadCompanyFromDB(selectedRecord);
                showTab('estimate');
                break;
            case 'clients':
                loadClientFromDB(selectedRecord);
                showTab('estimate');
                break;
            case 'estimates':
                loadEstimateFromDB(selectedRecord.id);
                showTab('estimate');
                break;
            case 'daily_records':
                loadDailyRecordFromDB(selectedRecord.id);
                showTab('daily');
                break;
        }
        alert('선택한 데이터가 불러와졌습니다.');
    } catch (error) {
        console.error('Load record error:', error);
        alert('데이터 불러오기 중 오류가 발생했습니다.');
    }
}

// 회사 정보 불러오기 (DB)
function loadCompanyFromDB(record) {
    document.getElementById('company-name').value = record.name || '';
    document.getElementById('business-number').value = record.business_number || '';
    document.getElementById('company-address').value = record.address || '';
    document.getElementById('company-ceo').value = record.ceo || '';
    document.getElementById('company-type').value = record.type || '';
    document.getElementById('company-item').value = record.item || '';
    document.getElementById('company-phone').value = record.phone || '';
    document.getElementById('company-fax').value = record.fax || '';
    document.getElementById('company-manager').value = record.manager || '';
}

// 고객 정보 불러오기 (DB)
function loadClientFromDB(record) {
    if (record.type === 'individual') {
        document.getElementById('client-type').value = 'individual';
        toggleClientFields();
        document.getElementById('individual-name').value = record.name || '';
        document.getElementById('individual-phone').value = record.phone || '';
    } else {
        document.getElementById('client-type').value = 'business';
        toggleClientFields();
        document.getElementById('client-name').value = record.name || '';
        document.getElementById('client-business').value = record.business_number || '';
        document.getElementById('client-address').value = record.address || '';
        document.getElementById('client-ceo').value = record.ceo || '';
        document.getElementById('client-contact').value = record.phone || '';
        document.getElementById('client-manager').value = record.manager || '';
    }
}

// 선택한 레코드 삭제 (백엔드 API 사용)
async function deleteSelectedRecord() {
    if (!selectedRecord || !selectedDataType) {
        alert('삭제할 데이터를 선택해주세요.');
        return;
    }
    
    if (!confirm('선택한 데이터를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        let apiUrl = '';
        switch (selectedDataType) {
            case 'companies':
                apiUrl = `/api/companies/${selectedRecord.id}`;
                break;
            case 'clients':
                apiUrl = `/api/clients/${selectedRecord.id}`;
                break;
            case 'estimates':
                apiUrl = `/api/estimates/${selectedRecord.id}`;
                break;
            case 'daily_records':
                apiUrl = `/api/daily_records/${selectedRecord.id}`;
                break;
        }
        
        const response = await fetch(apiUrl, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`삭제 실패: ${response.status}`);
        }
        
        const result = await response.json();
        alert(result.message || '데이터가 삭제되었습니다.');
        loadDatabaseRecords(); // 테이블 새로고침
        
    } catch (error) {
        console.error('Delete record error:', error);
        alert('데이터 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 견적서 불러오기 (백엔드 API 사용)
async function loadEstimateFromDB(estimateId) {
    try {
        const response = await fetch(`/api/estimates/${estimateId}`);
        if (!response.ok) {
            throw new Error(`견적서 조회 실패: ${response.status}`);
        }
        
        const estimate = await response.json();
        document.getElementById('estimate-number').value = estimate.estimate_number || '';
        document.getElementById('estimate-date').value = estimate.estimate_date || '';
        document.getElementById('valid-until').value = estimate.valid_until || '';
        
        // 견적 항목들 로드
        if (estimate.items && estimate.items.length > 0) {
            const tbody = document.querySelector('#estimate-items tbody');
            
            // 기존 행들 모두 제거하고 새로 추가
            tbody.innerHTML = '';
            
            estimate.items.forEach((item, index) => {
                // 새 행 생성 (HTML 직접 생성)
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td>
                        <select class="item-category">
                            <option value="철거공사">철거공사</option>
                            <option value="목공사">목공사</option>
                            <option value="타일공사">타일공사</option>
                            <option value="도배공사">도배공사</option>
                            <option value="바닥공사">바닥공사</option>
                            <option value="전기공사">전기공사</option>
                            <option value="설비공사">설비공사</option>
                            <option value="도장공사">도장공사</option>
                            <option value="기타">기타</option>
                        </select>
                    </td>
                    <td><input type="text" class="item-name" placeholder="시공항목명"></td>
                    <td><input type="text" class="item-spec" placeholder="규격/단위"></td>
                    <td><input type="number" class="item-quantity" placeholder="수량" min="1" value="1"></td>
                    <td><input type="number" class="item-price" placeholder="단가" min="0"></td>
                    <td class="item-total">0</td>
                    <td><input type="text" class="item-note" placeholder="비고"></td>
                    <td><button type="button" class="delete-btn" onclick="deleteRow(this)">삭제</button></td>
                `;
                
                tbody.appendChild(newRow);
                
                // 데이터 설정
                newRow.querySelector('.item-category').value = item.category || '';
                newRow.querySelector('.item-name').value = item.name || '';
                newRow.querySelector('.item-spec').value = item.spec || '';
                newRow.querySelector('.item-quantity').value = item.quantity || 1;
                newRow.querySelector('.item-price').value = item.price || 0;
                newRow.querySelector('.item-note').value = item.note || '';
                
                // 금액 업데이트
                updateItemTotal(newRow.querySelector('.item-quantity'));
            });
            
            updateEstimateTotal();
        }
        
    } catch (error) {
        console.error('Load estimate error:', error);
        alert('견적서 불러오기 중 오류가 발생했습니다: ' + error.message);
    }
}

// 일일 기록 불러오기 (백엔드 API 사용)
async function loadDailyRecordFromDB(recordId) {
    try {
        const response = await fetch(`/api/daily_records/${recordId}`);
        if (!response.ok) {
            throw new Error(`영수증 기록 조회 실패: ${response.status}`);
        }
        
        const record = await response.json();
        document.getElementById('daily-date').value = record.daily_date || '';
        document.getElementById('site-name').value = record.site_name || '';
        
        // 영수증 항목들 로드
        if (record.items && record.items.length > 0) {
            const tbody = document.querySelector('#daily-items tbody');
            tbody.innerHTML = ''; // 기존 항목 삭제
            
            record.items.forEach(item => {
                const row = addDailyRow();
                const lastRow = tbody.lastElementChild;
                
                lastRow.querySelector('.daily-category').value = item.category || '';
                lastRow.querySelector('.daily-content').value = item.content || '';
                lastRow.querySelector('.daily-rate').value = item.rate || 0;
                lastRow.querySelector('.daily-note').value = item.note || '';
            });
            
            updateDailyTotal();
        }
        
    } catch (error) {
        console.error('Load daily record error:', error);
        alert('영수증 기록 불러오기 중 오류가 발생했습니다: ' + error.message);
    }
}

// 선택 해제
function clearSelection() {
    selectedRecord = null;
    selectedDataType = null;
    selectedRecords.clear();
    
    const selectedRows = document.querySelectorAll('#records-table tr.selected');
    selectedRows.forEach(row => row.classList.remove('selected'));
    
    const checkboxes = document.querySelectorAll('.record-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
    
    updateSelectionInfo();
}

// 데이터베이스 내보내기
function exportDatabase() {
    if (!db) return;
    
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estimate_database_${new Date().toISOString().split('T')[0]}.db`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 데이터베이스 가져오기
function importDatabase() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const uintArray = new Uint8Array(arrayBuffer);
            
            try {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                db = new SQL.Database(uintArray);
                saveDatabase();
                alert('데이터베이스를 성공적으로 가져왔습니다.');
            } catch (error) {
                console.error('Database import error:', error);
                alert('데이터베이스 가져오기 중 오류가 발생했습니다.');
            }
        }
    };
    input.click();
}

// 데이터베이스 초기화
function clearDatabase() {
    if (confirm('모든 데이터가 삭제됩니다. 계속하시겠습니까?')) {
        localStorage.removeItem('estimateDatabase');
        initDatabase();
        alert('데이터베이스가 초기화되었습니다.');
    }
}

// 전화번호 자동 포맷팅 함수
function formatPhoneNumber(input) {
    // 숫자만 추출
    let phoneNumber = input.value.replace(/\D/g, '');
    
    // 길이에 따라 포맷팅
    if (phoneNumber.length <= 3) {
        input.value = phoneNumber;
    } else if (phoneNumber.length <= 7) {
        input.value = phoneNumber.substring(0, 3) + '-' + phoneNumber.substring(3);
    } else if (phoneNumber.length <= 11) {
        if (phoneNumber.substring(0, 2) === '02') {
            // 서울 지역번호
            input.value = phoneNumber.substring(0, 2) + '-' + phoneNumber.substring(2, 6) + '-' + phoneNumber.substring(6);
        } else {
            // 일반 전화번호
            input.value = phoneNumber.substring(0, 3) + '-' + phoneNumber.substring(3, 7) + '-' + phoneNumber.substring(7);
        }
    } else {
        // 11자리 초과시 자르기
        phoneNumber = phoneNumber.substring(0, 11);
        if (phoneNumber.substring(0, 2) === '02') {
            input.value = phoneNumber.substring(0, 2) + '-' + phoneNumber.substring(2, 6) + '-' + phoneNumber.substring(6);
        } else {
            input.value = phoneNumber.substring(0, 3) + '-' + phoneNumber.substring(3, 7) + '-' + phoneNumber.substring(7);
        }
    }
}

// 사업자등록번호 자동 포맷팅 함수
function formatBusinessNumber(input) {
    // 숫자만 추출
    let businessNumber = input.value.replace(/\D/g, '');
    
    // 10자리로 제한
    if (businessNumber.length > 10) {
        businessNumber = businessNumber.substring(0, 10);
    }
    
    // 길이에 따라 포맷팅 (000-00-00000)
    if (businessNumber.length <= 3) {
        input.value = businessNumber;
    } else if (businessNumber.length <= 5) {
        input.value = businessNumber.substring(0, 3) + '-' + businessNumber.substring(3);
    } else {
        input.value = businessNumber.substring(0, 3) + '-' + 
                     businessNumber.substring(3, 5) + '-' + 
                     businessNumber.substring(5);
    }
}

// 견적번호 자동 생성 (오늘날짜 + 일련번호)
async function generateEstimateNumber() {
    try {
        const today = new Date();
        const dateStr = today.getFullYear().toString().slice(-2) + 
                       String(today.getMonth() + 1).padStart(2, '0') + 
                       String(today.getDate()).padStart(2, '0');
        
        // 오늘 날짜의 견적서 개수 조회
        const response = await fetch('/api/estimates');
        if (!response.ok) {
            throw new Error('견적서 조회 실패');
        }
        
        const estimates = await response.json();
        const todayEstimates = estimates.filter(est => {
            if (!est.estimate_number) return false;
            return est.estimate_number.startsWith(dateStr);
        });
        
        const count = todayEstimates.length + 1;
        const countStr = String(count).padStart(3, '0');
        
        return `${dateStr}-${countStr}`;
    } catch (error) {
        console.error('견적번호 생성 오류:', error);
        const today = new Date();
        const dateStr = today.getFullYear().toString().slice(-2) + 
                       String(today.getMonth() + 1).padStart(2, '0') + 
                       String(today.getDate()).padStart(2, '0');
        return `${dateStr}-001`;
    }
}

// 회사 정보 드롭다운 로드
async function loadCompanyDropdown() {
    try {
        const response = await fetch('/api/companies');
        if (!response.ok) return;
        
        const companies = await response.json();
        const select = document.getElementById('company-dropdown');
        if (!select) return;
        
        select.innerHTML = '<option value="">회사 선택</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company[0]; // id
            option.textContent = company[1]; // name
            select.appendChild(option);
        });
    } catch (error) {
        console.error('회사 드롭다운 로드 오류:', error);
    }
}

// 고객 정보 드롭다운 로드
async function loadClientDropdown() {
    try {
        const response = await fetch('/api/clients');
        if (!response.ok) return;
        
        const clients = await response.json();
        const select = document.getElementById('client-dropdown');
        if (!select) return;
        
        select.innerHTML = '<option value="">고객 선택</option>';
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.name} (${client.type})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('고객 드롭다운 로드 오류:', error);
    }
}

// 회사 정보 드롭다운 선택
async function onCompanyDropdownChange() {
    const dropdown = document.getElementById('company-dropdown');
    const companyId = dropdown.value;
    
    if (!companyId) return;
    
    try {
        const response = await fetch('/api/companies');
        if (!response.ok) return;
        
        const companies = await response.json();
        const company = companies.find(c => c[0] == companyId);
        
        if (company) {
            document.getElementById('company-name').value = company[1] || '';
            document.getElementById('business-number').value = company[2] || '';
            document.getElementById('company-address').value = company[3] || '';
            document.getElementById('company-ceo').value = company[4] || '';
            document.getElementById('company-type').value = company[5] || '';
            document.getElementById('company-item').value = company[6] || '';
            document.getElementById('company-phone').value = company[7] || '';
            document.getElementById('company-fax').value = company[8] || '';
            document.getElementById('company-manager').value = company[9] || '';
        }
    } catch (error) {
        console.error('회사 정보 로드 오류:', error);
    }
}

// 고객 정보 드롭다운 선택
async function onClientDropdownChange() {
    const dropdown = document.getElementById('client-dropdown');
    const clientId = dropdown.value;
    
    if (!clientId) return;
    
    try {
        const response = await fetch('/api/clients');
        if (!response.ok) return;
        
        const clients = await response.json();
        const client = clients.find(c => c.id == clientId);
        
        if (client) {
            // 고객 타입에 따라 필드 전환
            document.getElementById('client-type').value = client.type;
            toggleClientFields();
            
            if (client.type === 'business') {
                document.getElementById('client-name').value = client.name || '';
                document.getElementById('client-business').value = client.business_number || '';
                document.getElementById('client-address').value = client.address || '';
                document.getElementById('client-ceo').value = client.ceo || '';
                document.getElementById('client-contact').value = client.phone || '';
                document.getElementById('client-manager').value = client.manager || '';
            } else {
                document.getElementById('individual-name').value = client.name || '';
                document.getElementById('individual-phone').value = client.phone || '';
            }
        }
    } catch (error) {
        console.error('고객 정보 로드 오류:', error);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded - 초기화 시작');
    
    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('estimate-date').value = today;
    document.getElementById('daily-date').value = today;
    
    // 유효기간을 30일 후로 설정
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    document.getElementById('valid-until').value = validUntil.toISOString().split('T')[0];
    
    // 견적번호 자동 생성
    try {
        const estimateNumber = await generateEstimateNumber();
        document.getElementById('estimate-number').value = estimateNumber;
    } catch (error) {
        console.error('견적번호 생성 실패:', error);
    }
    
    // 이벤트 리스너 추가 (가장 먼저)
    addEventListeners();
    console.log('이벤트 리스너 추가 완료');
    
    // 초기 계산
    updateEstimateTotal();
    updateDailyTotal();
    console.log('초기 계산 완료');
    
    // 전화번호 필드에 자동 포맷팅 적용
    const phoneInputs = document.querySelectorAll('input[type="text"][id*="phone"], input[type="text"][id*="contact"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
    });
    
    // 사업자등록번호 필드에 자동 포맷팅 적용
    const businessInputs = document.querySelectorAll('input[id="business-number"], input[id="client-business"]');
    businessInputs.forEach(input => {
        input.addEventListener('input', function() {
            formatBusinessNumber(this);
        });
    });
    
    // 데이터베이스 관련은 나중에 초기화 (비블로킹)
    setTimeout(async () => {
        try {
            await initDatabase();
            autoLoadCompanyInfo();
            // 견적서 드롭다운 초기화
            await loadEstimateDropdown();
            // 회사/고객/은행 드롭다운 초기화
            await loadCompanyDropdown();
            await loadClientDropdown();
            await loadBankDropdown();
        } catch (error) {
            console.error('데이터베이스 초기화 실패:', error);
        }
    }, 100);
});

// 탭 전환 함수
function showTab(tabName) {
    // 모든 탭 숨기기
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 선택한 탭 활성화
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
}

// 이벤트 리스너 추가 (간단하고 확실한 방법)
function addEventListeners() {
    console.log('이벤트 리스너 설정 중...');
    
    // 견적서 테이블에 이벤트 위임 적용
    const estimateTable = document.getElementById('estimate-items');
    if (estimateTable) {
        estimateTable.addEventListener('input', function(e) {
            if (e.target.matches('input[type="number"]')) {
                console.log('견적서 입력 이벤트 발생:', e.target.className, e.target.value);
                updateItemTotal(e.target);
                updateEstimateTotal();
            }
        });
        
        estimateTable.addEventListener('change', function(e) {
            if (e.target.matches('input[type="number"]')) {
                console.log('견적서 변경 이벤트 발생:', e.target.className, e.target.value);
                updateItemTotal(e.target);
                updateEstimateTotal();
            }
        });
    }
    
    // 영수증 테이블에 이벤트 위임 적용
    const dailyTable = document.getElementById('daily-items');
    if (dailyTable) {
        dailyTable.addEventListener('input', function(e) {
            if (e.target.matches('input[type="number"]')) {
                console.log('영수증 입력 이벤트 발생:', e.target.className, e.target.value);
                updateDailyTotal();
            }
        });
        
        dailyTable.addEventListener('change', function(e) {
            if (e.target.matches('input[type="number"]')) {
                console.log('영수증 변경 이벤트 발생:', e.target.className, e.target.value);
                updateDailyTotal();
            }
        });
    }
    
    console.log('이벤트 리스너 설정 완료');
    
    // 디버깅을 위한 테스트 함수
    window.testCalculation = function() {
        console.log('=== 금액 계산 테스트 시작 ===');
        
        // 첫 번째 행의 수량과 단가 필드 찾기
        const firstRow = document.querySelector('#estimate-items tbody tr');
        if (firstRow) {
            const quantityInput = firstRow.querySelector('.item-quantity');
            const priceInput = firstRow.querySelector('.item-price');
            
            if (quantityInput && priceInput) {
                // 테스트 값 설정
                quantityInput.value = 2;
                priceInput.value = 500000;
                
                console.log('테스트 값 설정 완료:', {
                    quantity: quantityInput.value,
                    price: priceInput.value
                });
                
                // 수동으로 계산 함수 호출
                updateItemTotal(quantityInput);
                updateEstimateTotal();
                
                console.log('=== 금액 계산 테스트 완료 ===');
            } else {
                console.error('입력 필드를 찾을 수 없습니다.');
            }
        } else {
            console.error('첫 번째 행을 찾을 수 없습니다.');
        }
    };
}

// 견적서 항목 추가
function addEstimateRow() {
    const tbody = document.querySelector('#estimate-items tbody');
    const newRow = tbody.rows[0].cloneNode(true);
    
    // 입력값 초기화
    newRow.querySelectorAll('input').forEach(input => {
        input.value = input.type === 'number' && input.classList.contains('item-quantity') ? '1' : '';
    });
    newRow.querySelector('.item-total').textContent = '0';
    
    // 카테고리 선택을 첫 번째 옵션으로 리셋
    const categorySelect = newRow.querySelector('.item-category');
    if (categorySelect) {
        categorySelect.selectedIndex = 0;
    }
    
    tbody.appendChild(newRow);
}

// 견적서 항목 삭제
function deleteRow(button) {
    const tbody = document.querySelector('#estimate-items tbody');
    if (tbody.rows.length > 1) {
        button.closest('tr').remove();
        updateEstimateTotal();
    }
}

// 시공 명세서 항목 추가
function addDailyRow() {
    const tbody = document.querySelector('#daily-items tbody');
    const newRow = tbody.rows[0].cloneNode(true);
    
    // 입력값 초기화
    newRow.querySelectorAll('input').forEach(input => {
        input.value = '';
    });
    newRow.querySelector('.daily-amount').textContent = '0';
    
    // 카테고리 선택을 첫 번째 옵션으로 리셋
    const categorySelect = newRow.querySelector('.daily-category');
    if (categorySelect) {
        categorySelect.selectedIndex = 0;
    }
    
    
    tbody.appendChild(newRow);
}

// 영수증 기록 항목 삭제
function deleteDailyRow(button) {
    const tbody = document.querySelector('#daily-items tbody');
    if (tbody.rows.length > 1) {
        button.closest('tr').remove();
        updateDailyTotal();
    }
}

// 개별 항목 금액 계산
function updateItemTotal(input) {
    const row = input.closest('tr');
    const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const total = quantity * price;
    
    console.log('updateItemTotal:', {quantity, price, total});
    row.querySelector('.item-total').textContent = formatNumber(total);
}

// 견적서 총액 계산
function updateEstimateTotal() {
    const rows = document.querySelectorAll('#estimate-items tbody tr');
    let subtotal = 0;
    
    rows.forEach(row => {
        const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        subtotal += quantity * price;
        
        // 개별 항목 총액 업데이트
        row.querySelector('.item-total').textContent = formatNumber(quantity * price);
    });
    
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    
    console.log('updateEstimateTotal:', {subtotal, tax, total});
    
    document.getElementById('subtotal').textContent = formatNumber(subtotal) + '원';
    document.getElementById('tax').textContent = formatNumber(tax) + '원';
    document.getElementById('total').textContent = formatNumber(total) + '원';
}

// 시공 명세서 총액 계산
function updateDailyTotal() {
    const rows = document.querySelectorAll('#daily-items tbody tr');
    let total = 0;
    
    rows.forEach(row => {
        const rate = parseFloat(row.querySelector('.daily-rate').value) || 0;
        const amount = rate; // 인원이 제거되었으므로 단가가 곧 금액
        
        // 개별 행의 금액 업데이트
        const amountCell = row.querySelector('.daily-amount');
        if (amountCell) {
            amountCell.textContent = formatNumber(amount);
        }
        
        total += amount;
    });
    
    document.getElementById('daily-total').textContent = formatNumber(total) + '원';
}

// 숫자 포맷팅 (천단위 콤마)
function formatNumber(num) {
    return Math.round(num).toLocaleString('ko-KR');
}

// 숫자를 한글로 변환하는 함수 (정만 한자)
function numberToKorean(num) {
    const koreanNumbers = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    
    if (num === 0) return '영원 正';
    
    let result = '';
    
    // 조, 억, 만 단위로 분리
    const trillion = Math.floor(num / 1000000000000);
    const hundred_million = Math.floor((num % 1000000000000) / 100000000);
    const ten_thousand = Math.floor((num % 100000000) / 10000);
    const remainder = num % 10000;
    
    // 조 단위 처리
    if (trillion > 0) {
        result += convertThousands(trillion) + '조';
    }
    
    // 억 단위 처리
    if (hundred_million > 0) {
        result += convertThousands(hundred_million) + '억';
    }
    
    // 만 단위 처리
    if (ten_thousand > 0) {
        result += convertThousands(ten_thousand) + '만';
    }
    
    // 나머지 천의 자리 이하 처리
    if (remainder > 0) {
        result += convertThousands(remainder);
    }
    
    return result + '원 正';
    
    // 천 단위 이하를 한글로 변환하는 보조 함수
    function convertThousands(number) {
        let str = '';
        const thousands = Math.floor(number / 1000);
        const hundreds = Math.floor((number % 1000) / 100);
        const tens = Math.floor((number % 100) / 10);
        const units = number % 10;
        
        if (thousands > 0) {
            if (thousands === 1) {
                str += '천';  // "일천"이 아니라 "천"
            } else {
                str += koreanNumbers[thousands] + '천';
            }
        }
        if (hundreds > 0) {
            if (hundreds === 1) {
                str += '백';  // "일백"이 아니라 "백"
            } else {
                str += koreanNumbers[hundreds] + '백';
            }
        }
        if (tens > 0) {
            if (tens === 1) {
                str += '십';  // "일십"이 아니라 "십"
            } else {
                str += koreanNumbers[tens] + '십';
            }
        }
        if (units > 0) {
            str += koreanNumbers[units];
        }
        
        return str;
    }
}

// 디지털 도장 생성 함수
function generateDigitalSeal(companyName) {
    if (!companyName) return '';
    
    // 상호명을 기반으로 한 간단한 원형 도장 SVG 생성
    const sealSize = 40;
    const centerX = sealSize / 2;
    const centerY = sealSize / 2;
    const outerRadius = sealSize / 2 - 1;
    const innerRadius = outerRadius - 5;
    
    // 텍스트 길이에 따른 폰트 크기 조정
    let fontSize = Math.max(6, Math.min(8, 120 / companyName.length));
    
    return `
        <svg width="${sealSize}" height="${sealSize}" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-left: 5px;">
            <defs>
                <style>
                    .seal-text { 
                        fill: #dc3545; 
                        font-family: '맑은 고딕', sans-serif; 
                        font-weight: bold; 
                        text-anchor: middle; 
                        dominant-baseline: central;
                        font-size: ${fontSize}px;
                    }
                    .seal-border { 
                        fill: none; 
                        stroke: #dc3545; 
                        stroke-width: 2; 
                    }
                </style>
            </defs>
            
            <!-- 외부 테두리 -->
            <circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" class="seal-border"/>
            
            <!-- 내부 테두리 -->
            <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" class="seal-border"/>
            
            <!-- 회사명 텍스트 -->
            <text x="${centerX}" y="${centerY - 2}" class="seal-text">${companyName}</text>
            
            <!-- 하단에 "印" 문자 -->
            <text x="${centerX}" y="${centerY + fontSize + 2}" class="seal-text" style="font-size: ${fontSize - 1}px;">印</text>
        </svg>
    `;
}

// 필드 유효성 검증
function validateBusinessNumber(number) {
    const pattern = /^[0-9]{3}-[0-9]{2}-[0-9]{5}$/;
    return pattern.test(number);
}

function validatePhone(phone) {
    const pattern = /^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/;
    return pattern.test(phone);
}

// 견적서 생성 및 미리보기
function generateEstimate() {
    // 공급업체 정보
    const companyName = document.getElementById('company-name').value;
    const businessNumber = document.getElementById('business-number').value;
    const companyAddress = document.getElementById('company-address').value;
    const companyCeo = document.getElementById('company-ceo').value;
    const companyType = document.getElementById('company-type').value;
    const companyItem = document.getElementById('company-item').value;
    const companyPhone = document.getElementById('company-phone').value;
    const companyFax = document.getElementById('company-fax').value;
    const companyManager = document.getElementById('company-manager').value;
    
    // 고객 정보 (유형에 따라)
    const clientType = document.getElementById('client-type').value;
    let clientName, clientBusiness, clientAddress, clientCeo, clientContact, clientManager;
    
    if (clientType === 'business') {
        clientName = document.getElementById('client-name').value;
        clientBusiness = document.getElementById('client-business').value;
        clientAddress = document.getElementById('client-address').value;
        clientCeo = document.getElementById('client-ceo').value;
        clientContact = document.getElementById('client-contact').value;
        clientManager = document.getElementById('client-manager').value;
    } else {
        clientName = document.getElementById('individual-name').value;
        clientContact = document.getElementById('individual-phone').value;
        clientBusiness = '';
        clientAddress = '';
        clientCeo = clientName; // 개인고객의 경우 이름을 대표자명으로
        clientManager = '';
    }
    
    const estimateNumber = document.getElementById('estimate-number').value;
    const estimateDate = document.getElementById('estimate-date').value;
    const validUntil = document.getElementById('valid-until').value;
    
    const bankName = document.getElementById('bank-name').value;
    const accountNumber = document.getElementById('account-number').value;
    const accountHolder = document.getElementById('account-holder').value;
    
    // 필수 필드 검증
    if (!companyName) {
        alert('공급업체 상호명을 입력해주세요.');
        return;
    }
    if (!clientName) {
        alert('고객명을 입력해주세요.');
        return;
    }
    if (!clientContact) {
        alert('고객 전화번호를 입력해주세요.');
        return;
    }
    if (!estimateDate) {
        alert('견적일자를 선택해주세요.');
        return;
    }
    
    // 사업자등록번호 유효성 검증
    if (businessNumber && !validateBusinessNumber(businessNumber)) {
        alert('공급업체 등록번호 형식이 올바르지 않습니다. (000-00-00000)');
        return;
    }
    if (clientType === 'business' && clientBusiness && !validateBusinessNumber(clientBusiness)) {
        alert('수요업체 등록번호 형식이 올바르지 않습니다. (000-00-00000)');
        return;
    }
    
    // 전화번호 유효성 검증
    if (companyPhone && !validatePhone(companyPhone)) {
        alert('공급업체 전화번호 형식이 올바르지 않습니다. (000-0000-0000)');
        return;
    }
    if (clientContact && !validatePhone(clientContact)) {
        alert('고객 전화번호 형식이 올바르지 않습니다. (000-0000-0000)');
        return;
    }
    
    const rows = document.querySelectorAll('#estimate-items tbody tr');
    let itemsHtml = '';
    let hasValidItems = false;
    
    rows.forEach(row => {
        const category = row.querySelector('.item-category') ? row.querySelector('.item-category').value : '';
        const itemName = row.querySelector('.item-name').value;
        const spec = row.querySelector('.item-spec') ? row.querySelector('.item-spec').value : '';
        const quantity = row.querySelector('.item-quantity').value;
        const price = row.querySelector('.item-price').value;
        const total = row.querySelector('.item-total').textContent;
        const note = row.querySelector('.item-note') ? row.querySelector('.item-note').value : '';
        
        if (itemName && quantity && price) {
            hasValidItems = true;
            // 규격에서 단위 분리
            const specParts = spec ? spec.split('/') : ['', ''];
            const specOnly = specParts[0] || '';
            const unit = specParts[1] || 'EA';
            
            itemsHtml += `
                <tr>
                    <td>${category}</td>
                    <td>${itemName}</td>
                    <td>${specOnly}</td>
                    <td>${unit}</td>
                    <td>${formatNumber(quantity)}</td>
                    <td>${formatNumber(price)}</td>
                    <td>${total.replace('원', '')}</td>
                    <td>${note}</td>
                </tr>
            `;
        }
    });
    
    if (!hasValidItems) {
        alert('견적 항목을 하나 이상 입력해주세요.');
        return;
    }
    
    const subtotal = document.getElementById('subtotal').textContent;
    const tax = document.getElementById('tax').textContent;
    const total = document.getElementById('total').textContent;
    
    const previewHtml = `
        <div class="estimate-preview">
            <div class="preview-title">
                <h1>견 적 서</h1>
                <div class="estimate-info">
                    <div>견적번호: ${estimateNumber || 'EST-' + new Date().getFullYear() + new Date().getMonth() + new Date().getDate()}</div>
                    <div>견적일자: ${formatDate(estimateDate)}</div>
                </div>
            </div>
            
            <div class="business-info">
                <div class="supplier-info">
                    <table class="info-table">
                        <tr><th colspan="2" class="section-title">공급받는자</th></tr>
                        <tr><td class="label">등록번호</td><td>${clientBusiness || (clientType === 'individual' ? '개인' : '')}</td></tr>
                        <tr><td class="label">상호</td><td><strong>${clientName}</strong></td></tr>
                        <tr><td class="label">성명</td><td>${clientCeo || ''}</td></tr>
                        <tr><td class="label">주소</td><td>${clientAddress || ''}</td></tr>
                        <tr><td class="label">전화번호</td><td>${clientContact || ''}</td></tr>
                    </table>
                </div>
                <div class="customer-info">
                    <table class="info-table">
                        <tr><th colspan="2" class="section-title">공급자</th></tr>
                        <tr><td class="label">등록번호</td><td>${businessNumber || ''}</td></tr>
                        <tr><td class="label">상호</td><td><strong>${companyName}</strong></td></tr>
                        <tr><td class="label">성명</td><td>${companyCeo || ''}</td></tr>
                        <tr><td class="label">주소</td><td>${companyAddress}</td></tr>
                        <tr><td class="label">업태</td><td>${companyType}</td></tr>
                        <tr><td class="label">종목</td><td>${companyItem}</td></tr>
                        <tr><td class="label">전화번호</td><td>${companyPhone}</td></tr>
                    </table>
                </div>
            </div>
            
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>공종</th>
                        <th>품목</th>
                        <th>규격</th>
                        <th>단위</th>
                        <th>수량</th>
                        <th>단가</th>
                        <th>공급가액</th>
                        <th>비고</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="amount-summary">
                <div class="korean-amount" style="text-align: center; margin-bottom: 10px; padding: 8px; border: 1px solid #9ca3af; background: #f9fafb; font-size: 9pt; font-weight: bold;">
                    금액: ${numberToKorean(Math.round(parseFloat(total.replace(/[^0-9]/g, ''))))}
                </div>
                <table class="summary-table">
                    <tr>
                        <td class="label">공급가액</td>
                        <td class="amount">${subtotal}</td>
                        <td class="label">세액</td>
                        <td class="amount">${tax}</td>
                        <td class="label final">합계금액</td>
                        <td class="amount final">${total}</td>
                    </tr>
                </table>
            </div>
            
            ${bankName ? `
            <div class="payment-details">
                <h4>■ 입금계좌</h4>
                <p>은행: ${bankName} / 계좌: ${accountNumber} / 예금주: ${accountHolder}</p>
            </div>
            ` : ''}
            
            <div class="estimate-conditions">
                <h4>■ 견적조건</h4>
                <ul>
                    <li>상기 견적금액은 부가가치세가 포함된 금액입니다.</li>
                    <li>견적유효기간: ${formatDate(validUntil)} 까지</li>
                    <li>납기: 계약체결 후 별도 협의</li>
                    <li>하자보수: 준공 후 1년간</li>
                    <li>기타 조건은 별도 협의합니다.</li>
                </ul>
            </div>
            
            <div class="signature-area">
                <p style="text-align: center; margin-top: 40px;">
                    위와 같이 견적서를 제출합니다.
                </p>
                <div style="text-align: right; margin-top: 30px;">
                    <p><strong>${companyName}</strong></p>
                    <p>대표자: ${companyCeo} ${generateDigitalSeal(companyName)}</p>
                    <p>담당자: ${companyManager}</p>
                </div>
            </div>
        </div>
    `;
    
    // 견적서를 데이터베이스에 저장
    saveEstimateToDB(companyName, clientName, estimateNumber, estimateDate, validUntil, subtotal, tax, total, itemsHtml);
    
    showPreview(previewHtml);
}

// 견적서 데이터베이스 저장
function saveEstimateToDB(companyName, clientName, estimateNumber, estimateDate, validUntil, subtotal, tax, total, items) {
    if (!db) return;
    
    try {
        const stmt = db.prepare(`
            INSERT INTO estimates (estimate_number, estimate_date, valid_until, subtotal, tax, total, items)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
            estimateNumber, estimateDate, validUntil,
            parseFloat(subtotal.replace(/[^0-9]/g, '')),
            parseFloat(tax.replace(/[^0-9]/g, '')),
            parseFloat(total.replace(/[^0-9]/g, '')),
            items
        ]);
        stmt.free();
        saveDatabase();
    } catch (error) {
        console.error('견적서 DB 저장 오류:', error);
    }
}

// 일일 시공 명세서 생성 및 미리보기
function generateDaily() {
    const dailyDate = document.getElementById('daily-date').value;
    const siteName = document.getElementById('site-name').value;
    
    if (!dailyDate) {
        alert('시공일자를 선택해주세요.');
        return;
    }
    
    if (!siteName) {
        alert('현장명을 입력해주세요.');
        return;
    }
    
    const rows = document.querySelectorAll('#daily-items tbody tr');
    let itemsHtml = '';
    let hasValidItems = false;
    
    rows.forEach(row => {
        const category = row.querySelector('.daily-category').value;
        const content = row.querySelector('.daily-content').value;
        const rate = row.querySelector('.daily-rate').value;
        const amount = row.querySelector('.daily-amount').textContent;
        const note = row.querySelector('.daily-note').value;
        
        if (content && rate) {
            hasValidItems = true;
            itemsHtml += `
                <tr>
                    <td>${category}</td>
                    <td>${content}</td>
                    <td>${formatNumber(rate)}원</td>
                    <td>${amount}원</td>
                    <td>${note || '-'}</td>
                </tr>
            `;
        }
    });
    
    if (!hasValidItems) {
        alert('사용 내역을 하나 이상 입력해주세요.');
        return;
    }
    
    const total = document.getElementById('daily-total').textContent;
    
    const previewHtml = `
        <div class="daily-preview">
            <h1>일일 영수증 기록 내역서</h1>
            
            <div style="text-align: center; margin: 30px 0; font-size: 1.2em; background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <div><strong>현장명: ${siteName}</strong></div>
                <div style="margin-top: 10px;"><strong>기록일자: ${formatDate(dailyDate)}</strong></div>
            </div>
            
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>카테고리</th>
                        <th>사용내역</th>
                        <th>단가</th>
                        <th>금액</th>
                        <th>비고</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="preview-total">
                <div class="final-total">당일 총 사용비: ${total}</div>
            </div>
            
            <div class="preview-notes" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin-bottom: 15px; color: #2c3e50;">■ 사용 내역</h4>
                <p style="margin: 0; line-height: 1.6;">상기와 같이 ${formatDate(dailyDate)} 사용내역을 기록하였음을 확인합니다.</p>
            </div>
        </div>
    `;
    
    // 일일 기록을 데이터베이스에 저장
    saveDailyRecordToDB(dailyDate, siteName, itemsHtml, total);
    
    showPreview(previewHtml);
}

// 일일 기록 데이터베이스 저장
function saveDailyRecordToDB(date, siteName, items, total) {
    if (!db) return;
    
    try {
        const stmt = db.prepare(`
            INSERT INTO daily_records (date, site_name, items, total)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run([
            date, siteName, items,
            parseFloat(total.replace(/[^0-9]/g, ''))
        ]);
        stmt.free();
        saveDatabase();
    } catch (error) {
        console.error('일일 기록 DB 저장 오류:', error);
    }
}

// 미리보기 표시
function showPreview(html) {
    document.getElementById('preview-content').innerHTML = html;
    document.getElementById('preview-section').style.display = 'block';
    document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth' });
}

// 미리보기 닫기
function closePreview() {
    document.getElementById('preview-section').style.display = 'none';
}

// 인쇄
function printDocument() {
    const printContent = document.getElementById('preview-content').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    
    // 페이지 리로드하여 기능 복원
    location.reload();
}

// 날짜 포맷팅
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// 엑셀 내보내기 - 견적서
// Python 백엔드를 통한 견적서 엑셀 내보내기
function exportEstimateToExcel() {
    const estimateData = collectEstimateData();
    if (!estimateData) return;
    
    // Python 백엔드로 데이터 전송
    fetch('/api/export_estimate_excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(estimateData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('엑셀 생성 중 오류가 발생했습니다.');
        }
        return response.blob();
    })
    .then(blob => {
        // 파일 다운로드
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const clientName = document.getElementById('client-name').value || 
                          document.getElementById('individual-name').value || '고객';
        const estimateDate = document.getElementById('estimate-date').value;
        a.href = url;
        a.download = `${estimateDate}_${clientName}_견적서.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    });
}

// 견적서 데이터 수집 함수
function collectEstimateData() {
    const estimateDate = document.getElementById('estimate-date').value;
    const clientType = document.getElementById('client-type').value;
    
    if (!estimateDate) {
        alert('견적일자를 입력해주세요.');
        return null;
    }
    
    // 회사 정보
    const company = {
        name: document.getElementById('company-name').value,
        business_number: document.getElementById('business-number').value,
        address: document.getElementById('company-address').value,
        ceo: document.getElementById('company-ceo').value,
        phone: document.getElementById('company-phone').value,
        type: document.getElementById('company-type').value,
        item: document.getElementById('company-item').value
    };
    
    // 고객 정보
    const client = {};
    if (clientType === 'individual') {
        client.name = document.getElementById('individual-name').value;
        client.phone = document.getElementById('individual-phone').value;
        client.type = 'individual';
    } else {
        client.name = document.getElementById('client-name').value;
        client.business_number = document.getElementById('client-business').value;
        client.address = document.getElementById('client-address').value;
        client.ceo = document.getElementById('client-ceo').value;
        client.phone = document.getElementById('client-contact').value;
        client.type = 'business';
    }
    
    // 견적 항목
    const items = [];
    const rows = document.querySelectorAll('#estimate-items tbody tr');
    rows.forEach(row => {
        const category = row.querySelector('.item-category').value;
        const name = row.querySelector('.item-name').value;
        const spec = row.querySelector('.item-spec').value;
        const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const note = row.querySelector('.item-note').value;
        
        if (name && quantity > 0 && price > 0) {
            const specParts = spec ? spec.split('/') : ['', 'EA'];
            items.push({
                category: category,
                name: name,
                spec: specParts[0] || '',
                unit: specParts[1] || 'EA',
                quantity: quantity,
                price: price,
                total: quantity * price,
                note: note
            });
        }
    });
    
    if (items.length === 0) {
        alert('견적 항목을 하나 이상 입력해주세요.');
        return null;
    }
    
    const subtotalText = document.getElementById('subtotal').textContent.replace('원', '').replace(/,/g, '');
    const taxText = document.getElementById('tax').textContent.replace('원', '').replace(/,/g, '');
    const totalText = document.getElementById('total').textContent.replace('원', '').replace(/,/g, '');
    
    return {
        estimate_number: document.getElementById('estimate-number').value,
        estimate_date: estimateDate,
        valid_until: document.getElementById('valid-until').value,
        company: company,
        client: client,
        items: items,
        subtotal: parseFloat(subtotalText) || 0,
        tax: parseFloat(taxText) || 0,
        total: parseFloat(totalText) || 0
    };
}

// 견적서 DB 저장
async function saveEstimateToDB() {
    console.log('견적서 저장 시작');
    
    const estimateData = collectEstimateData();
    if (!estimateData) return;
    
    if (!estimateData.estimate_number) {
        alert('견적번호를 입력해주세요.');
        return;
    }
    
    if (estimateData.items.length === 0) {
        alert('견적 항목을 하나 이상 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch('/api/estimates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                estimate_number: estimateData.estimate_number,
                estimate_date: estimateData.estimate_date,
                valid_until: document.getElementById('valid-until').value,
                subtotal: estimateData.subtotal,
                tax: estimateData.tax,
                total: estimateData.total,
                items: estimateData.items,
                company: estimateData.company,
                client: estimateData.client
            })
        });
        
        if (!response.ok) {
            throw new Error(`저장 실패: ${response.status}`);
        }
        
        const result = await response.json();
        alert(result.message || '견적서가 저장되었습니다.');
        
        // 드롭다운 새로고침
        await loadEstimateDropdown();
        
        // 견적번호 새로 생성
        const newEstimateNumber = await generateEstimateNumber();
        document.getElementById('estimate-number').value = newEstimateNumber;
        
    } catch (error) {
        console.error('Save estimate error:', error);
        alert('견적서 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 견적서 드롭다운 로드 (최신 5개)
async function loadEstimateDropdown() {
    try {
        const response = await fetch('/api/estimates');
        if (!response.ok) {
            throw new Error(`조회 실패: ${response.status}`);
        }
        
        const estimates = await response.json();
        const dropdown = document.getElementById('estimate-dropdown');
        
        if (!dropdown) return;
        
        // 드롭다운 초기화
        dropdown.innerHTML = '<option value="">저장된 견적서 선택</option>';
        
        // 최신 5개만 표시
        const recentEstimates = estimates.slice(0, 5);
        
        recentEstimates.forEach(estimate => {
            const option = document.createElement('option');
            option.value = estimate.id;
            option.textContent = `${estimate.estimate_number} (${estimate.estimate_date}) - ${formatNumber(estimate.total_amount || 0)}원`;
            dropdown.appendChild(option);
        });
        
        // 5개 이상이면 "더보기" 옵션 추가
        if (estimates.length > 5) {
            const moreOption = document.createElement('option');
            moreOption.value = 'more';
            moreOption.textContent = '⋯ 더 많은 견적서 보기 (데이터 관리)';
            dropdown.appendChild(moreOption);
        }
        
    } catch (error) {
        console.error('Load dropdown error:', error);
    }
}

// 견적서 드롭다운 선택 처리
async function onEstimateDropdownChange() {
    const dropdown = document.getElementById('estimate-dropdown');
    const selectedValue = dropdown.value;
    
    if (!selectedValue) return;
    
    if (selectedValue === 'more') {
        // 데이터 관리 탭으로 이동
        showTab('database');
        document.getElementById('data-type-filter').value = 'estimates';
        await loadDatabaseRecords();
        return;
    }
    
    try {
        const estimateId = parseInt(selectedValue);
        await loadEstimateFromDB(estimateId);
        alert('선택한 견적서가 불러와졌습니다.');
    } catch (error) {
        console.error('Load estimate error:', error);
        alert('견적서 불러오기 중 오류가 발생했습니다: ' + error.message);
    }
}

// 견적일자 선택시 유효기간 자동 설정 (1달 후)
function updateValidUntilDate() {
    const estimateDate = document.getElementById('estimate-date').value;
    if (!estimateDate) return;
    
    const date = new Date(estimateDate);
    date.setMonth(date.getMonth() + 1); // 1달 후
    
    const validUntilInput = document.getElementById('valid-until');
    validUntilInput.value = date.toISOString().split('T')[0];
    
    console.log('견적유효기간 자동 설정:', validUntilInput.value);
}

// 영수증 기록 저장
async function saveDailyRecordToDB() {
    console.log('영수증 기록 저장 시작');
    
    const dailyData = collectDailyData();
    if (!dailyData) return;
    
    if (!dailyData.site_name) {
        alert('현장명을 입력해주세요.');
        return;
    }
    
    if (dailyData.items.length === 0) {
        alert('사용 내역을 하나 이상 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch('/api/daily_records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                daily_date: dailyData.date,
                site_name: dailyData.site_name,
                total_amount: dailyData.total,
                items: dailyData.items
            })
        });
        
        if (!response.ok) {
            throw new Error(`저장 실패: ${response.status}`);
        }
        
        const result = await response.json();
        alert(result.message || '영수증 기록이 저장되었습니다.');
        
    } catch (error) {
        console.error('Save daily record error:', error);
        alert('영수증 기록 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// Python 백엔드를 통한 영수증 기록 엑셀 내보내기
function exportDailyToExcel() {
    const dailyData = collectDailyData();
    if (!dailyData) return;
    
    // Python 백엔드로 데이터 전송
    fetch('/api/export_daily_excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dailyData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('엑셀 생성 중 오류가 발생했습니다.');
        }
        return response.blob();
    })
    .then(blob => {
        // 파일 다운로드
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const siteName = document.getElementById('site-name').value || '영수증기록';
        const dailyDate = document.getElementById('daily-date').value;
        a.href = url;
        a.download = `${dailyDate}_${siteName}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    });
}

// 영수증 기록 데이터 수집 함수
function collectDailyData() {
    const dailyDate = document.getElementById('daily-date').value;
    const siteName = document.getElementById('site-name').value;
    
    if (!dailyDate) {
        alert('날짜를 선택해주세요.');
        return null;
    }
    
    // 데이터 행 수집
    const items = [];
    const rows = document.querySelectorAll('#daily-items tbody tr');
    let hasValidItems = false;
    
    rows.forEach(row => {
        const category = row.querySelector('.daily-category').value;
        const content = row.querySelector('.daily-content').value;
        const rate = row.querySelector('.daily-rate').value;
        const amount = row.querySelector('.daily-amount').textContent;
        const note = row.querySelector('.daily-note').value;
        
        if (content && rate) {
            hasValidItems = true;
            const rateNum = parseInt(rate);
            const amountNum = parseFloat(amount.replace('원', '').replace(/,/g, ''));
            
            items.push({
                category: category,
                content: content,
                rate: rateNum,
                amount: amountNum,
                note: note || ''
            });
        }
    });
    
    if (!hasValidItems) {
        alert('사용 내역을 하나 이상 입력해주세요.');
        return null;
    }
    
    return {
        date: dailyDate,
        site_name: siteName,
        items: items
    };
}

// PDF 내보내기 - 견적서 (직접 생성)
function exportEstimateToPDF() {
    const companyName = document.getElementById('company-name').value;
    const clientName = document.getElementById('client-name').value;
    const estimateDate = document.getElementById('estimate-date').value;
    
    if (!companyName || !clientName || !estimateDate) {
        alert('필수 정보를 모두 입력해주세요.');
        return;
    }
    
    // 견적서 생성 후 PDF로 변환
    generateEstimate();
    
    // 잠시 후 PDF 생성
    setTimeout(() => {
        downloadCurrentAsPDF();
    }, 500);
}

// 현재 미리보기를 PDF로 다운로드
function downloadCurrentAsPDF() {
    const element = document.querySelector('.estimate-preview, .daily-preview');
    
    if (!element) {
        alert('미리보기가 생성되지 않았습니다. 먼저 견적서를 생성해주세요.');
        return;
    }
    
    // jsPDF 인스턴스 생성 (A4 크기)
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // HTML을 캔버스로 변환
    html2canvas(element, {
        scale: 2, // 고해상도
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: 794, // A4 너비 (96 DPI)
        windowHeight: 1123 // A4 높이 (96 DPI)
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        
        // A4 크기에 맞게 이미지 크기 조정
        const pdfWidth = 210; // A4 너비 (mm)
        const pdfHeight = 297; // A4 높이 (mm)
        
        const imgWidth = pdfWidth - 20; // 좌우 여백 10mm씩
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 10; // 상단 여백 10mm
        
        // 첫 페이지 추가
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20); // 상하 여백 20mm 제외
        
        // 여러 페이지가 필요한 경우
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight + 10;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - 20);
        }
        
        // 파일명 생성
        const clientName = document.getElementById('client-name').value || '고객';
        const estimateDate = document.getElementById('estimate-date').value || new Date().toISOString().split('T')[0];
        const dailyDate = document.getElementById('daily-date').value || new Date().toISOString().split('T')[0];
        const fileName = element.classList.contains('estimate-preview') 
            ? `${estimateDate}_${clientName}_인테리어견적서.pdf`
            : `${dailyDate}_시공명세서.pdf`;
        
        // PDF 저장
        pdf.save(fileName);
    }).catch(error => {
        console.error('PDF 생성 중 오류 발생:', error);
        alert('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    });
}

// 고품질 PDF 생성을 위한 대체 함수
function generateHighQualityPDF() {
    const element = document.querySelector('.estimate-preview, .daily-preview');
    
    if (!element) {
        alert('미리보기가 생성되지 않았습니다.');
        return;
    }
    
    // 원본 스타일 저장
    const originalStyle = element.style.cssText;
    
    // PDF 최적화를 위한 임시 스타일 적용
    element.style.cssText += `
        width: 210mm !important;
        padding: 15mm !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        background: white !important;
        color: black !important;
    `;
    
    // 헤더 배경색 강제 설정
    const header = element.querySelector('.preview-header');
    if (header) {
        header.style.cssText += 'background: #34495e !important; color: white !important;';
    }
    
    // 테이블 헤더 배경색 강제 설정
    const tableHeaders = element.querySelectorAll('.preview-table th');
    tableHeaders.forEach(th => {
        th.style.cssText += 'background: #34495e !important; color: white !important;';
    });
    
    // 총계 배경색 강제 설정
    const finalTotal = element.querySelector('.final-total');
    if (finalTotal) {
        finalTotal.style.cssText += 'background: #2c3e50 !important; color: white !important;';
    }
    
    html2canvas(element, {
        scale: 3, // 매우 고해상도
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 너비 (픽셀)
        height: 1123, // A4 높이 (픽셀)
        scrollX: 0,
        scrollY: 0
    }).then(canvas => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        
        // 파일명 생성
        const clientName = document.getElementById('client-name').value || '고객';
        const estimateDate = document.getElementById('estimate-date').value || new Date().toISOString().split('T')[0];
        const dailyDate = document.getElementById('daily-date').value || new Date().toISOString().split('T')[0];
        const fileName = element.classList.contains('estimate-preview') 
            ? `${estimateDate}_${clientName}_인테리어견적서.pdf`
            : `${dailyDate}_시공명세서.pdf`;
        
        pdf.save(fileName);
        
        // 원본 스타일 복원
        element.style.cssText = originalStyle;
    }).catch(error => {
        console.error('고품질 PDF 생성 중 오류 발생:', error);
        // 원본 스타일 복원
        element.style.cssText = originalStyle;
        alert('PDF 생성 중 오류가 발생했습니다.');
    });
}

// 회사 정보 저장
function saveCompanyInfo() {
    const companyInfo = {
        name: document.getElementById('company-name').value,
        businessNumber: document.getElementById('business-number').value,
        address: document.getElementById('company-address').value,
        ceo: document.getElementById('company-ceo').value,
        type: document.getElementById('company-type').value,
        item: document.getElementById('company-item').value,
        phone: document.getElementById('company-phone').value,
        fax: document.getElementById('company-fax').value,
        manager: document.getElementById('company-manager').value
    };
    
    if (!companyInfo.name) {
        alert('상호명을 입력해주세요.');
        return;
    }
    
    localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
    
    alert('공급업체 정보가 저장되었습니다.');
}

// 회사 정보 불러오기
function loadCompanyInfo() {
    const savedInfo = localStorage.getItem('companyInfo');
    
    if (!savedInfo) {
        alert('저장된 공급업체 정보가 없습니다.');
        return;
    }
    
    const companyInfo = JSON.parse(savedInfo);
    
    document.getElementById('company-name').value = companyInfo.name || '';
    document.getElementById('business-number').value = companyInfo.businessNumber || '';
    document.getElementById('company-address').value = companyInfo.address || '';
    document.getElementById('company-ceo').value = companyInfo.ceo || '';
    document.getElementById('company-type').value = companyInfo.type || '';
    document.getElementById('company-item').value = companyInfo.item || '';
    document.getElementById('company-phone').value = companyInfo.phone || '';
    document.getElementById('company-fax').value = companyInfo.fax || '';
    document.getElementById('company-manager').value = companyInfo.manager || '';
    
    alert('공급업체 정보가 불러와졌습니다.');
}

// 자동으로 회사 정보 불러오기 (알림 없이)
function autoLoadCompanyInfo() {
    const savedInfo = localStorage.getItem('companyInfo');
    
    if (savedInfo) {
        const companyInfo = JSON.parse(savedInfo);
        
        document.getElementById('company-name').value = companyInfo.name || '';
        document.getElementById('business-number').value = companyInfo.businessNumber || '';
        document.getElementById('company-address').value = companyInfo.address || '';
        document.getElementById('company-ceo').value = companyInfo.ceo || '';
        document.getElementById('company-type').value = companyInfo.type || '';
        document.getElementById('company-item').value = companyInfo.item || '';
        document.getElementById('company-phone').value = companyInfo.phone || '';
        document.getElementById('company-fax').value = companyInfo.fax || '';
        document.getElementById('company-manager').value = companyInfo.manager || '';
    }
    
    // 은행계좌 정보 자동 불러오기
    const savedBankInfo = localStorage.getItem('bankInfo');
    if (savedBankInfo) {
        const bankInfo = JSON.parse(savedBankInfo);
        document.getElementById('bank-name').value = bankInfo.name || '';
        document.getElementById('account-number').value = bankInfo.number || '';
        document.getElementById('account-holder').value = bankInfo.holder || '';
    }
    
    // 고객 정보 자동 불러오기
    const savedClientInfo = localStorage.getItem('clientInfo');
    if (savedClientInfo) {
        const clientInfo = JSON.parse(savedClientInfo);
        document.getElementById('client-type').value = clientInfo.type;
        toggleClientFields();
        
        if (clientInfo.type === 'business') {
            document.getElementById('client-name').value = clientInfo.name || '';
            document.getElementById('client-business').value = clientInfo.business || '';
            document.getElementById('client-address').value = clientInfo.address || '';
            document.getElementById('client-ceo').value = clientInfo.ceo || '';
            document.getElementById('client-contact').value = clientInfo.contact || '';
            document.getElementById('client-manager').value = clientInfo.manager || '';
        } else {
            document.getElementById('individual-name').value = clientInfo.name || '';
            document.getElementById('individual-phone').value = clientInfo.phone || '';
        }
    }
}

// 고객 유형 전환
function toggleClientFields() {
    const clientType = document.getElementById('client-type').value;
    const businessClient = document.getElementById('business-client');
    const individualClient = document.getElementById('individual-client');
    
    if (clientType === 'business') {
        businessClient.style.display = 'block';
        individualClient.style.display = 'none';
    } else {
        businessClient.style.display = 'none';
        individualClient.style.display = 'block';
    }
}

// 고객 정보 저장
function saveClientInfo() {
    const clientType = document.getElementById('client-type').value;
    
    if (clientType === 'business') {
        const clientInfo = {
            type: 'business',
            name: document.getElementById('client-name').value,
            business: document.getElementById('client-business').value,
            address: document.getElementById('client-address').value,
            ceo: document.getElementById('client-ceo').value,
            contact: document.getElementById('client-contact').value,
            manager: document.getElementById('client-manager').value
        };
        
        if (!clientInfo.name) {
            alert('상호명을 입력해주세요.');
            return;
        }
        
        localStorage.setItem('clientInfo', JSON.stringify(clientInfo));
        alert('수요업체 정보가 저장되었습니다.');
    } else {
        const clientInfo = {
            type: 'individual',
            name: document.getElementById('individual-name').value,
            phone: document.getElementById('individual-phone').value
        };
        
        if (!clientInfo.name || !clientInfo.phone) {
            alert('고객명과 전화번호를 입력해주세요.');
            return;
        }
        
        localStorage.setItem('clientInfo', JSON.stringify(clientInfo));
        alert('고객 정보가 저장되었습니다.');
    }
}

// 은행 계좌 드롭다운 로드
async function loadBankDropdown() {
    try {
        const response = await fetch('/api/bank_accounts');
        if (!response.ok) return;
        
        const accounts = await response.json();
        const select = document.getElementById('bank-dropdown');
        if (!select) return;
        
        select.innerHTML = '<option value="">계좌 선택</option>';
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.bank_name} - ${account.account_number} (${account.account_holder})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('은행 계좌 드롭다운 로드 오류:', error);
    }
}

// 은행 계좌 드롭다운 선택
async function onBankDropdownChange() {
    const dropdown = document.getElementById('bank-dropdown');
    const accountId = dropdown.value;
    
    if (!accountId) return;
    
    try {
        const response = await fetch('/api/bank_accounts');
        if (!response.ok) return;
        
        const accounts = await response.json();
        const account = accounts.find(a => a.id == accountId);
        
        if (account) {
            document.getElementById('bank-name').value = account.bank_name || '';
            document.getElementById('account-number').value = account.account_number || '';
            document.getElementById('account-holder').value = account.account_holder || '';
        }
    } catch (error) {
        console.error('계좌 정보 로드 오류:', error);
    }
}

// 은행 계좌 DB 저장
async function saveBankToDB() {
    const bankData = {
        bank_name: document.getElementById('bank-name').value,
        account_number: document.getElementById('account-number').value,
        account_holder: document.getElementById('account-holder').value
    };
    
    if (!bankData.bank_name || !bankData.account_number || !bankData.account_holder) {
        alert('모든 계좌 정보를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch('/api/bank_accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bankData)
        });
        
        if (!response.ok) {
            throw new Error(`저장 실패: ${response.status}`);
        }
        
        const result = await response.json();
        alert(result.message || '계좌 정보가 저장되었습니다.');
        
        // 드롭다운 새로고침
        await loadBankDropdown();
        
    } catch (error) {
        console.error('Bank save error:', error);
        alert('계좌 정보 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 고객 정보 DB 저장
async function saveClientToDB() {
    const clientType = document.getElementById('client-type').value;
    let clientData;
    
    if (clientType === 'business') {
        clientData = {
            type: 'business',
            name: document.getElementById('client-name').value,
            business_number: document.getElementById('client-business').value,
            address: document.getElementById('client-address').value,
            ceo: document.getElementById('client-ceo').value,
            contact: document.getElementById('client-contact').value,
            manager: document.getElementById('client-manager').value
        };
        
        if (!clientData.name) {
            alert('상호명을 입력해주세요.');
            return;
        }
    } else {
        clientData = {
            type: 'individual',
            name: document.getElementById('individual-name').value,
            business_number: '',
            address: '',
            ceo: '',
            contact: document.getElementById('individual-phone').value,
            manager: ''
        };
        
        if (!clientData.name || !clientData.contact) {
            alert('고객명과 전화번호를 입력해주세요.');
            return;
        }
    }
    
    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clientData)
        });
        
        if (!response.ok) {
            throw new Error(`저장 실패: ${response.status}`);
        }
        
        const result = await response.json();
        alert(result.message || '고객 정보가 데이터베이스에 저장되었습니다.');
        
        // 드롭다운 새로고침
        await loadClientDropdown();
        
    } catch (error) {
        console.error('Client save error:', error);
        alert('고객 정보 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 고객 정보 불러오기
function loadClientInfo() {
    const savedInfo = localStorage.getItem('clientInfo');
    
    if (!savedInfo) {
        alert('저장된 고객 정보가 없습니다.');
        return;
    }
    
    const clientInfo = JSON.parse(savedInfo);
    
    document.getElementById('client-type').value = clientInfo.type;
    toggleClientFields();
    
    if (clientInfo.type === 'business') {
        document.getElementById('client-name').value = clientInfo.name || '';
        document.getElementById('client-business').value = clientInfo.business || '';
        document.getElementById('client-address').value = clientInfo.address || '';
        document.getElementById('client-ceo').value = clientInfo.ceo || '';
        document.getElementById('client-contact').value = clientInfo.contact || '';
        document.getElementById('client-manager').value = clientInfo.manager || '';
    } else {
        document.getElementById('individual-name').value = clientInfo.name || '';
        document.getElementById('individual-phone').value = clientInfo.phone || '';
    }
    
    alert('고객 정보가 불러와졌습니다.');
}

// 은행계좌 정보 저장
function saveBankInfo() {
    const bankInfo = {
        name: document.getElementById('bank-name').value,
        number: document.getElementById('account-number').value,
        holder: document.getElementById('account-holder').value
    };
    
    if (!bankInfo.name || !bankInfo.number || !bankInfo.holder) {
        alert('은행계좌 정보를 모두 입력해주세요.');
        return;
    }
    
    localStorage.setItem('bankInfo', JSON.stringify(bankInfo));
    alert('은행계좌 정보가 저장되었습니다.');
}

// 은행계좌 정보 불러오기
function loadBankInfo() {
    const savedInfo = localStorage.getItem('bankInfo');
    
    if (!savedInfo) {
        alert('저장된 은행계좌 정보가 없습니다.');
        return;
    }
    
    const bankInfo = JSON.parse(savedInfo);
    
    document.getElementById('bank-name').value = bankInfo.name || '';
    document.getElementById('account-number').value = bankInfo.number || '';
    document.getElementById('account-holder').value = bankInfo.holder || '';
    
    alert('은행계좌 정보가 불러와졌습니다.');
}