/**
 * ==========================================================================
 * 바이브 카페 (Vibe Cafe) 주문서 및 주문 내역 스크립트 - script.js
 * ==========================================================================
 * 초보자도 쉽게 이해할 수 있도록 단계별로 작성된 주문서 동작 로직입니다.
 */

// ==========================================================================
// 1. Supabase 접속 정보 상수 설정
// - 사용자의 Supabase 프로젝트 대시보드(Settings > API)에서 URL과 anon KEY를 복사해 넣어주세요.
// ==========================================================================
const SUPABASE_URL = 'https://hjevzlhsrkjfyrehdpvj.supabase.co'; // 예: 'https://your-project-id.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZXZ6bGhzcmtqZnlyZWhkcHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzc0NTksImV4cCI6MjEwNjgxMzQ1OX0.-huODpLY2Q-1uZmo72CNagKc0r9jVase9eqYqdl829I'; // 예: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// Supabase 클라이언트 변수 생성 (클라이언트 변수 이름: supabaseClient)
// URL과 KEY가 유효하게 입력되었을 때만 초기화하여 미입력 상태에서도 자바스크립트 에러를 방지합니다.
let supabaseClient = null;
try {
  if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (err) {
  console.error('Supabase 클라이언트 생성 중 오류 발생:', err);
}

// HTML 문서가 모두 불러와지면 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------------------
  // 2. 필요한 HTML 요소(DOM) 가져오기
  // ------------------------------------------------------------------------
  // 탭 네비게이션 및 컨텐츠 요소
  const tabOrderBtn = document.getElementById('tabOrderBtn');         // "☕ 주문하기" 탭 버튼
  const tabHistoryBtn = document.getElementById('tabHistoryBtn');     // "📋 주문 내역" 탭 버튼
  const orderBadge = document.getElementById('orderBadge');           // 주문 건수 배지 span
  const orderTabContent = document.getElementById('orderTabContent'); // 주문하기 탭 컨텐츠
  const historyTabContent = document.getElementById('historyTabContent'); // 주문 내역 탭 컨텐츠

  // 주문서 폼 관련 요소
  const orderForm = document.getElementById('orderForm');             // 주문서 폼 전체
  const customerName = document.getElementById('customerName');       // 고객 이름 입력칸
  const customerPhone = document.getElementById('customerPhone');     // 전화번호 입력칸
  const beverageSelect = document.getElementById('beverageSelect');   // 음료 선택 드롭다운
  const quantityInput = document.getElementById('quantity');         // 수량 입력칸
  const requestsInput = document.getElementById('requests');         // 요청사항 입력칸
  const totalPriceElement = document.getElementById('totalPrice');   // 예상 금액 표시 span
  const submitBtn = document.getElementById('submitBtn');             // 주문하기 버튼
  const orderConfirmation = document.getElementById('orderConfirmation'); // 주문 확인 메시지 영역

  // 주문 내역 탭 관련 요소
  const orderList = document.getElementById('orderList');             // 주문 카드들이 들어갈 컨테이너
  const historySummary = document.getElementById('historySummary');   // 하단 요약 컨테이너
  const totalHistoryText = document.getElementById('totalHistoryText'); // "총 주문 금액" 텍스트
  const beverageSummaryText = document.getElementById('beverageSummaryText'); // 음료별 판매 잔수 요약 텍스트
  const clearAllBtn = document.getElementById('clearAllBtn');         // "내역 모두 지우기" 버튼

  // ------------------------------------------------------------------------
  // 3. 로컬 주문 데이터 관리 변수
  // ------------------------------------------------------------------------
  let orders = [];       // 화면에 보여줄 주문 목록을 보관하는 배열
  let nextOrderId = 1;   // 오프라인/기본 주문 번호 카운터

  // ------------------------------------------------------------------------
  // 4. 탭 메뉴 전환 기능
  // - hidden 클래스를 활용하여 화면 전환 및 탭 스타일을 변경합니다.
  // ------------------------------------------------------------------------
  // [주문하기 탭 클릭]
  tabOrderBtn.addEventListener('click', () => {
    tabOrderBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');

    orderTabContent.classList.remove('hidden');
    historyTabContent.classList.add('hidden');
  });

  // [주문 내역 탭 클릭]
  tabHistoryBtn.addEventListener('click', () => {
    tabHistoryBtn.classList.add('active');
    tabOrderBtn.classList.remove('active');

    historyTabContent.classList.remove('hidden');
    orderTabContent.classList.add('hidden');

    // 탭을 열 때 최신 주문 목록을 다시 그립니다.
    renderOrders();
  });

  // ------------------------------------------------------------------------
  // 5. 예상 금액 계산 함수 (calculateTotal)
  // - 음료, 사이즈, 추가 옵션, 수량을 합산하여 총 금액을 반환하고 화면에 표시합니다.
  // ------------------------------------------------------------------------
  function calculateTotal() {
    // 5-1. 선택된 음료 확인
    const selectedBeverageOption = beverageSelect.options[beverageSelect.selectedIndex];
    const beveragePrice = Number(selectedBeverageOption.dataset.price) || 0;

    // [중요 조건] 음료를 아직 고르지 않았다면 무조건 0원으로 표시합니다.
    if (!beverageSelect.value) {
      totalPriceElement.textContent = '0';
      return 0;
    }

    // 5-2. 선택된 사이즈 추가 금액 확인 (라디오 버튼)
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizePrice = selectedSizeRadio ? (Number(selectedSizeRadio.dataset.price) || 0) : 0;

    // 5-3. 체크된 추가 옵션 금액 합산 (체크박스)
    const checkedOptionBoxes = document.querySelectorAll('input[name="option"]:checked');
    let optionPriceTotal = 0;
    checkedOptionBoxes.forEach((checkbox) => {
      optionPriceTotal += Number(checkbox.dataset.price) || 0;
    });

    // 5-4. 수량 확인 (숫자가 아니거나 1 미만이면 기본 1로 계산)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 5-5. 총 금액 계산: (음료 기본가 + 사이즈 추가금 + 옵션 합계) * 수량
    const singleCupPrice = beveragePrice + sizePrice + optionPriceTotal;
    const finalTotal = singleCupPrice * quantity;

    // 5-6. 화면의 "예상 금액" 영역에 천 단위 콤마(toLocaleString)를 적용하여 표시
    totalPriceElement.textContent = finalTotal.toLocaleString();

    return finalTotal;
  }

  // ------------------------------------------------------------------------
  // 6. 실시간 금액 변경 이벤트 연결
  // ------------------------------------------------------------------------
  orderForm.addEventListener('change', calculateTotal);
  quantityInput.addEventListener('input', calculateTotal);

  // ------------------------------------------------------------------------
  // 7. 주문 목록 화면 렌더링 함수 (renderOrders)
  // - orders 배열의 데이터를 읽어 주문 내역 화면을 다시 그립니다.
  // - 손님이 입력한 글자는 보안(XSS 방지)을 위해 innerHTML 대신 textContent로 삽입합니다.
  // ------------------------------------------------------------------------
  function renderOrders() {
    // 7-1. 주문 건수 배지 업데이트
    orderBadge.textContent = orders.length;

    // 7-2. 기존 목록 비우기
    orderList.textContent = '';

    // 7-3. 주문이 한 건도 없는 경우
    if (orders.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-orders';
      emptyMsg.textContent = '아직 주문 내역이 없어요 ☕';
      orderList.appendChild(emptyMsg);

      // 하단 통계 요약 영역 숨기기
      historySummary.classList.add('hidden');
      beverageSummaryText.textContent = '';
      return;
    }

    // 7-4. 주문이 있는 경우 하단 통계 요약 영역 표시
    historySummary.classList.remove('hidden');

    let totalHistoryAmount = 0;

    // 7-5. 각 주문 데이터를 순회하며 주문 카드 생성
    orders.forEach((order) => {
      totalHistoryAmount += order.totalAmount;

      // (1) 카드 컨테이너 (베이지 카드 + 왼쪽 갈색 세로줄)
      const card = document.createElement('div');
      card.className = 'order-card';

      // (2) 카드 상단 헤더 영역 (1줄 내용 & 취소 버튼)
      const cardHeader = document.createElement('div');
      cardHeader.className = 'order-card-header';

      // 1줄: "#1 홍길동님 · 5,000원"
      const titleSpan = document.createElement('span');
      titleSpan.className = 'order-title';
      titleSpan.textContent = `#${order.id} ${order.customerName}님 · ${order.totalAmount.toLocaleString()}원`;

      // 오른쪽 위 "취소" 버튼
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'order-cancel-btn';
      cancelBtn.textContent = '취소';

      // 취소 버튼 클릭 시 confirm으로 확인 후 삭제 처리
      cancelBtn.addEventListener('click', () => {
        const isConfirmed = confirm(`주문 #${order.id}을(를) 취소하시겠습니까?`);
        if (isConfirmed) {
          orders = orders.filter((item) => item.id !== order.id);
          renderOrders();
        }
      });

      cardHeader.appendChild(titleSpan);
      cardHeader.appendChild(cancelBtn);

      // (3) 2줄: "카페라떼 M사이즈 (샷 추가) 1잔"
      const itemDesc = document.createElement('div');
      itemDesc.className = 'order-item-desc';
      const optionsText = order.options.length > 0 ? ` (${order.options.join(', ')})` : '';
      itemDesc.textContent = `${order.beverage} ${order.size}${optionsText} ${order.quantity}잔`;

      // (4) 3줄: 요청사항(있을 때만) · 주문 시간
      const metaDiv = document.createElement('div');
      metaDiv.className = 'order-meta';
      if (order.requests) {
        metaDiv.textContent = `${order.requests} · ${order.orderTime}`;
      } else {
        metaDiv.textContent = order.orderTime;
      }

      // 카드에 조립 (textContent로 입력하여 안전)
      card.appendChild(cardHeader);
      card.appendChild(itemDesc);
      card.appendChild(metaDiv);

      // 전체 목록 컨테이너에 카드 추가
      orderList.appendChild(card);
    });

    // 7-6. 하단 통계 문구 갱신: "총 주문 금액: 15,000원 (3건)"
    totalHistoryText.textContent = `총 주문 금액: ${totalHistoryAmount.toLocaleString()}원 (${orders.length}건)`;

    // 7-7. 음료별 몇 잔 팔렸는지 집계 및 요약 ("카페라떼 3잔, 아메리카노 1잔")
    const beverageCounts = {};
    orders.forEach((order) => {
      beverageCounts[order.beverage] = (beverageCounts[order.beverage] || 0) + order.quantity;
    });

    const beverageSummary = Object.entries(beverageCounts)
      .sort((a, b) => b[1] - a[1]) // 판매량 내림차순 정렬
      .map(([beverage, count]) => `${beverage} ${count}잔`)
      .join(', ');

    beverageSummaryText.textContent = beverageSummary;
  }

  // ------------------------------------------------------------------------
  // 8. 내역 모두 지우기 버튼 처리
  // ------------------------------------------------------------------------
  clearAllBtn.addEventListener('click', () => {
    if (orders.length === 0) return;

    const isConfirmed = confirm('주문 내역을 모두 지우시겠습니까?');
    if (isConfirmed) {
      orders = [];
      renderOrders();
    }
  });

  // ------------------------------------------------------------------------
  // 9. 주문하기 버튼 클릭 처리 (Supabase oders 테이블에 주문 저장)
  // ------------------------------------------------------------------------
  orderForm.addEventListener('submit', async (event) => {
    // 폼 제출 시 새로고침 방지
    event.preventDefault();

    // 9-1. 이름 유효성 검사
    const nameValue = customerName.value.trim();
    if (!nameValue) {
      alert('이름을 입력해주세요');
      customerName.focus();
      return;
    }

    // 9-2. 음료 선택 유효성 검사
    if (!beverageSelect.value) {
      alert('음료를 선택해주세요');
      beverageSelect.focus();
      return;
    }

    // 9-3. Supabase 접속 설정 여부 확인
    if (!supabaseClient) {
      alert('script.js 맨 위의 SUPABASE_URL과 SUPABASE_KEY를 먼저 입력해주세요!');
      return;
    }

    // 9-4. 주문 상세 데이터 추출 및 가공
    const selectedOption = beverageSelect.options[beverageSelect.selectedIndex];
    const beverageName = selectedOption.text.split(' (')[0].trim(); // 음료 이름 (예: '카페라떼')
    const beveragePrice = Number(selectedOption.dataset.price) || 0; // 음료 기본 가격 (숫자)

    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizeValue = selectedSizeRadio ? selectedSizeRadio.value : 'M'; // 사이즈 (예: 'M')
    const sizeName = `${sizeValue}사이즈`;

    // 추가 옵션 이름 배열 추출
    const checkedOptions = document.querySelectorAll('input[name="option"]:checked');
    const optionNames = [];
    checkedOptions.forEach((checkbox) => {
      const label = document.querySelector(`label[for="${checkbox.id}"]`);
      if (label) {
        const cleanName = label.textContent.split(' (')[0].trim();
        optionNames.push(cleanName);
      }
    });

    const optionsText = optionNames.length > 0 ? ` (${optionNames.join(', ')})` : '';

    // 수량
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 요청사항
    const requestsText = requestsInput ? requestsInput.value.trim() : '';

    // 총 결제 금액
    const totalAmount = calculateTotal();
    const formattedTotal = totalAmount.toLocaleString();

    // 주문 시간 (화면 표시용)
    const now = new Date();
    const orderTimeString = now.toLocaleTimeString('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // 9-5. 저장하는 동안 버튼 비활성화 (중복 클릭 방지)
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = '주문 처리 중...';

    try {
      // 9-6. Supabase orders 테이블에 삽입할 객체 구성
      // 실제 데이터베이스 스키마: customer_name, customer_phone, beverage, size, options, quantity, requests, total_amount
      const orderPayload = {
        customer_name: nameValue,
        customer_phone: customerPhone.value.trim() || null,
        beverage: beverageName,
        size: sizeValue,
        options: optionNames,
        quantity: quantity,
        requests: requestsText || null,
        total_amount: totalAmount,
      };

      // Supabase orders 테이블 insert 요청
      const { data, error } = await supabaseClient
        .from('orders')
        .insert([orderPayload])
        .select();

      // 만약 Supabase에서 에러를 반환하면 catch 블록으로 이동
      if (error) {
        throw error;
      }

      // 9-7. 저장 성공 시 처리
      // Supabase에서 발급된 고유 id가 있으면 사용하고 없으면 카운터 사용
      const orderId = (data && data[0] && data[0].id) ? data[0].id : nextOrderId++;

      const newOrder = {
        id: orderId,
        customerName: nameValue,
        beverage: beverageName,
        size: sizeName,
        options: optionNames,
        quantity: quantity,
        requests: requestsText,
        totalAmount: totalAmount,
        orderTime: orderTimeString,
      };

      // 주문 목록 배열 맨 앞에 추가
      orders.unshift(newOrder);

      // 주문 내역 목록 화면 및 통계 갱신
      renderOrders();

      // 탭 배지 통통 튀는 애니메이션 실행
      orderBadge.classList.remove('bounce');
      void orderBadge.offsetWidth;
      orderBadge.classList.add('bounce');

      // 기존 주문 확인 메시지 조립 및 표시
      const confirmationMessage = `${nameValue}님, ${beverageName} ${sizeName}${optionsText} ${quantity}잔, 총 ${formattedTotal}원 주문이 접수되었습니다!`;
      orderConfirmation.textContent = confirmationMessage;
      orderConfirmation.style.display = 'block';
      orderConfirmation.removeAttribute('hidden');

      // 화면 하단 확인 메시지로 부드럽게 스크롤 이동
      orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      // 9-8. 저장 실패 시 알림 및 콘솔 에러 출력
      const errorDetail = err.message || (err.error_description ? err.error_description : '서버 오류');
      alert(`주문 저장에 실패했어요 (${errorDetail})`);
      console.error('Supabase 주문 저장 에러:', err);
    } finally {
      // 9-9. 저장 완료 후 주문하기 버튼 다시 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // ------------------------------------------------------------------------
  // 10. 다시 작성 버튼 처리 (주문서 폼만 초기화하고 주문 내역은 지우지 않음)
  // ------------------------------------------------------------------------
  orderForm.addEventListener('reset', () => {
    setTimeout(() => {
      // 사이즈 기본값인 M 사이즈를 다시 선택
      const sizeMRadio = document.getElementById('sizeM');
      if (sizeMRadio) {
        sizeMRadio.checked = true;
      }

      // 수량 기본값 1로 복귀
      quantityInput.value = '1';

      // 금액을 0원으로 재계산 및 갱신
      calculateTotal();

      // 주문 확인 메시지 영역 숨기기 및 내용 지우기
      orderConfirmation.textContent = '';
      orderConfirmation.style.display = 'none';
      orderConfirmation.setAttribute('hidden', '');
    }, 0);
  });

  // ------------------------------------------------------------------------
  // 11. 초기 화면 설정
  // ------------------------------------------------------------------------
  calculateTotal(); // 초기 예상 금액 0원 설정
  renderOrders();   // 초기 주문 내역 화면 렌더링
});
