/* ===================================================================
   EcoShop Certificate Generator v1.0
   Uses jsPDF via CDN (cdnjs.cloudflare.com)
   =================================================================== */

class TreeCertificate {
  constructor() {
    this.cdnLoaded = false;
  }

  async ensureJSPDF() {
    if (typeof window.jspdf !== 'undefined') return;
    if (this.cdnLoaded) return;

    try {
      const resp = await fetch('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const text = await resp.text();
      const script = document.createElement('script');
      script.textContent = text;
      document.head.appendChild(script);
      this.cdnLoaded = true;
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => { this.cdnLoaded = true; resolve(); };
        document.head.appendChild(script);
      });
    }
  }

  async generate(data) {
    await this.ensureJSPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const green = '#1D9E75';
    const dark = '#14532D';
    const gold = '#D4A843';
    const cx = pageW / 2;

    doc.setFillColor(29, 158, 117);
    doc.rect(0, 0, pageW, 8, 'F');
    doc.rect(0, pageH - 4, pageW, 4, 'F');

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 14, pageW - 28, pageH - 28, 4, 4, 'S');
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(1.5);
    doc.roundedRect(16, 16, pageW - 32, pageH - 32, 3, 3, 'S');

    doc.setDrawColor(212, 168, 67);
    doc.setLineWidth(0.5);
    doc.roundedRect(20, 20, pageW - 40, pageH - 40, 2, 2, 'S');

    doc.setFillColor(29, 158, 117);
    doc.circle(cx, 34, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('E', cx, 39, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(29, 158, 117);
    doc.text('CHỨNG CHỈ TRỒNG CÂY', cx, 58, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Chứng nhận đóng góp Quỹ Trồng Cây Xanh - EcoShop', cx, 66, { align: 'center' });

    doc.setDrawColor(212, 168, 67);
    doc.setLineWidth(0.3);
    const lineY = 72;
    doc.line(70, lineY, pageW - 70, lineY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(20, 83, 45);
    doc.text('Cảm ơn', cx, 90, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(29, 158, 117);
    doc.text(data.donorName || 'Nhà hảo tâm', cx, 106, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text('đã đóng góp', cx, 120, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(212, 168, 67);
    doc.text(`${data.trees} CÂY XANH`, cx, 140, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text('cho chiến dịch trồng cây gây rừng vì một Việt Nam xanh hơn', cx, 153, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const metaY = 168;
    const metaItems = [
      { label: 'Vị trí dự kiến', value: data.location || 'Lâm Đồng / Sơn La' },
      { label: 'Ngày cấp', value: data.date || new Date().toLocaleDateString('vi-VN') },
      { label: 'Mã chứng chỉ', value: data.certificateId || '' },
    ];

    metaItems.forEach((item, i) => {
      const x = 60 + i * 70;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 158, 117);
      doc.text(item.label, x, metaY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(item.value, x, metaY + 5, { align: 'center' });
    });

    doc.setDrawColor(212, 168, 67);
    doc.setLineWidth(0.3);
    doc.line(50, metaY + 14, pageW - 50, metaY + 14);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text('Chứng chỉ này được tạo tự động bởi EcoShop. Mỗi cây xanh sẽ được trồng tại các khu vực phủ xanh bản địa.', cx, metaY + 22, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('EcoShop — Organic & Eco-Friendly Store | delwyn.id.vn', cx, metaY + 33, { align: 'center' });

    return doc;
  }

  async download(data) {
    const doc = await this.generate(data);
    doc.save(`chung-chi-trong-cay-${data.certificateId || 'ecoshop'}.pdf`);
  }

  async getBlob(data) {
    const doc = await this.generate(data);
    return doc.output('blob');
  }

  async getDataUrl(data) {
    const doc = await this.generate(data);
    return doc.output('datauristring');
  }

  async shareFacebook(data) {
    const text = `🌱 Tôi vừa đóng góp ${data.trees} cây xanh cho Việt Nam qua EcoShop! Cùng chung tay nhé! 🌿`;
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}&u=${encodeURIComponent('https://delwyn.id.vn/quy-xanh.html')}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  async shareZalo(data) {
    const text = `🌱 Tôi vừa đóng góp ${data.trees} cây xanh cho Việt Nam qua EcoShop! Cùng chung tay nhé! 🌿`;
    const url = `https://zalo.me/share?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }
}

const treeCert = new TreeCertificate();
