#!/usr/bin/env python3
"""Quick Safety Inspection Form – print-ready PDF (A4, 0.25 in margins)."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black

# ── Page constants ────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4          # 595.28 × 841.89 pt
MARGIN = 0.25 * inch         # 18 pt
CW = PAGE_W - 2 * MARGIN     # content width  ≈ 559.28 pt
LX = MARGIN                  # left x

# ── Colours ───────────────────────────────────────────────────────────────────
C_DARK  = HexColor('#111111')   # main section headers
C_DGRAY = HexColor('#4a4a4a')   # sub-section headers
C_WHITE = white
C_BLACK = black

# ── Fixed section heights (pt) ────────────────────────────────────────────────
TITLE_H        = 60
VD_HDR_H       = 14
VD_R1_H        = 21
VD_R2_H        = 20
CD_HDR_H       = 14
CD_ROW_H       = 20
Q_GAP          = 8
Q_H            = 15
VI_HDR_H       = 15
VI_GAP         = 8
MEAS_HDR_H     = 14
MEAS_COLHDR_H  = 14
MEAS_CONTENT_H = 178
MEAS_GAP       = 5
INSP_HDR_H     = 14
INSP_COLHDR_H  = 14
INSP_ROW_H     = 65
INSP_GAP       = 5
TC_HDR_H       = 14
TC_BOX_H       = 85
NOTE_H         = 14
DISC_H         = 9
SIG_GAP        = 20
SIG_LABEL_H    = 14


def create_pdf(filename: str) -> None:
    c = canvas.Canvas(filename, pagesize=A4)
    c.setTitle("Quick Safety Inspection Form")

    cy = PAGE_H - MARGIN   # cursor: top of next element; decrements downward

    # ── low-level drawing helpers ─────────────────────────────────────────────

    def txt(s, x, y, bold=False, fs=7.5, color=C_BLACK, align="left"):
        c.setFillColor(color)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", fs)
        if align == "center":
            c.drawCentredString(x, y, s)
        elif align == "right":
            c.drawRightString(x, y, s)
        else:
            c.drawString(x, y, s)

    def cell(x, y_top, w, h, fill_color=None, lw=0.5):
        if fill_color:
            c.setFillColor(fill_color)
            c.rect(x, y_top - h, w, h, fill=1, stroke=0)
        c.setStrokeColor(C_BLACK)
        c.setLineWidth(lw)
        c.rect(x, y_top - h, w, h, fill=0, stroke=1)

    def vline(x, y_top, h, lw=0.5):
        c.setStrokeColor(C_BLACK)
        c.setLineWidth(lw)
        c.line(x, y_top, x, y_top - h)

    def hline(y, x1=LX, x2=LX + CW, lw=0.5):
        c.setStrokeColor(C_BLACK)
        c.setLineWidth(lw)
        c.line(x1, y, x2, y)

    def cb(cx, cy_center, sz=5.2):
        c.setFillColor(C_WHITE)
        c.setStrokeColor(C_BLACK)
        c.setLineWidth(0.5)
        c.rect(cx - sz / 2, cy_center - sz / 2, sz, sz, fill=1, stroke=1)

    def section_header(text, h, bg=C_DARK, fg=C_WHITE, fs=9.0, r=4):
        nonlocal cy
        c.setFillColor(bg)
        c.roundRect(LX, cy - h, CW, h, r, fill=1, stroke=0)
        c.setFillColor(fg)
        c.setFont("Helvetica-Bold", fs)
        c.drawCentredString(LX + CW / 2, cy - h / 2 - fs * 0.33, text)
        cy -= h

    def subsection_header(text, h, total_section_h, fs=8.5, r=4):
        """Dark-gray header with rounded top, flat bottom (sits atop a table)."""
        nonlocal cy
        # outer rounded border for the whole section
        c.setStrokeColor(C_BLACK)
        c.setLineWidth(0.5)
        c.roundRect(LX, cy - total_section_h, CW, total_section_h, r, fill=0, stroke=1)
        # fill the header region: full roundRect then overwrite bottom strip
        c.setFillColor(C_DGRAY)
        c.roundRect(LX, cy - h, CW, h, r, fill=1, stroke=0)
        c.rect(LX, cy - h, CW, h / 2, fill=1, stroke=0)   # flatten bottom corners
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", fs)
        c.drawCentredString(LX + CW / 2, cy - h / 2 - fs * 0.33, text)
        cy -= h

    # ── Column proportions (shared by MEASURE and INSPECT) ───────────────────
    HALF = CW / 2
    I_W  = HALF * 0.295   # item label column
    C_W  = HALF * 0.435   # condition column
    A_W  = HALF - I_W - C_W  # action column
    RX   = LX + HALF       # right-half start x

    def col_headers(h):
        nonlocal cy
        for side_x in (LX, RX):
            cell(side_x,           cy, I_W, h)
            cell(side_x + I_W,     cy, C_W, h)
            txt("Condition", side_x + I_W + C_W / 2,
                cy - h / 2 - 7.5 * 0.33, fs=7.5, align="center")
            cell(side_x + I_W + C_W, cy, A_W, h)
            txt("Action", side_x + I_W + C_W + A_W / 2,
                cy - h / 2 - 7.5 * 0.33, fs=7.5, align="center")
        cy -= h

    # ═════════════════════════════════════════════════════════════════════════
    # TITLE
    # ═════════════════════════════════════════════════════════════════════════
    c.setFillColor(C_BLACK)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(PAGE_W / 2, cy - TITLE_H / 2 - 28 * 0.33,
                        "QUICK SAFETY INSPECTION FORM")
    cy -= TITLE_H

    # ═════════════════════════════════════════════════════════════════════════
    # VEHICLE DETAILS
    # ═════════════════════════════════════════════════════════════════════════
    section_header("VEHICLE DETAILS", VD_HDR_H)

    # Row 1: Model | Year | Make | Plate No | KM Reading | Date
    vd_cols = [
        (CW * 0.185, "Model:"),
        (CW * 0.145, "Year:"),
        (CW * 0.185, "Make:"),
        (CW * 0.225, "Plate No:"),
        (CW * 0.140, "KM Reading"),
        (CW * 0.120, "Date:"),
    ]
    cell(LX, cy, CW, VD_R1_H)
    cx2 = LX
    for i, (cw, label) in enumerate(vd_cols):
        if i:
            vline(cx2, cy, VD_R1_H)
        txt(label, cx2 + 2, cy - VD_R1_H / 2 - 7.5 * 0.33, bold=True, fs=7.5)
        cx2 += cw
    cy -= VD_R1_H

    # Row 2: Manual □ | A/T □ | CVT □ | Gas □ | Diesel □ | EV/HEV □
    items_r2 = ["Manual", "A/T", "CVT", "Gas", "Diesel", "EV/HEV"]
    cw2 = CW / len(items_r2)
    cell(LX, cy, CW, VD_R2_H)
    cx2 = LX
    for i, item in enumerate(items_r2):
        if i:
            vline(cx2, cy, VD_R2_H)
        mid_y = cy - VD_R2_H / 2
        cb_x = cx2 + 7
        cb(cb_x, mid_y)
        txt(item, cb_x + 7, mid_y - 7.5 * 0.33, fs=7.5)
        cx2 += cw2
    cy -= VD_R2_H

    # ═════════════════════════════════════════════════════════════════════════
    # CUSTOMER DETAILS
    # ═════════════════════════════════════════════════════════════════════════
    section_header("COSTUMER DETAILS", CD_HDR_H)

    # Columns: Company | Title | FirstName/LastName | Mobile/Email | City/Barangay
    c1w = CW * 0.195
    c2w = CW * 0.110
    c3w = CW * 0.225
    c4w = CW * 0.240
    c5w = CW - c1w - c2w - c3w - c4w

    x2_ = LX + c1w
    x3_ = x2_ + c2w
    x4_ = x3_ + c3w
    x5_ = x4_ + c4w

    # Row 1
    cell(LX, cy, CW, CD_ROW_H)
    vline(x2_, cy, CD_ROW_H * 2)   # company divider spans both rows
    vline(x3_, cy, CD_ROW_H)
    vline(x4_, cy, CD_ROW_H)
    vline(x5_, cy, CD_ROW_H)
    iy = cy - CD_ROW_H / 2
    txt("Company:", LX + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    cb(x2_ + 8, iy); txt("Mr.", x2_ + 15, iy - 7.5 * 0.33, fs=7.5)
    txt("First Name:", x3_ + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    txt("Mobile No.", x4_ + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    txt("City:", x5_ + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    cy -= CD_ROW_H

    # Row 2
    cell(LX, cy, CW, CD_ROW_H)
    vline(x3_, cy, CD_ROW_H)
    vline(x4_, cy, CD_ROW_H)
    vline(x5_, cy, CD_ROW_H)
    iy = cy - CD_ROW_H / 2
    cb(x2_ + 8, iy); txt("Ms.", x2_ + 15, iy - 7.5 * 0.33, fs=7.5)
    txt("Last Name:", x3_ + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    txt("Email:", x4_ + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    txt("Barangay:", x5_ + 2, iy - 7.5 * 0.33, bold=True, fs=7.5)
    cy -= CD_ROW_H

    # ═════════════════════════════════════════════════════════════════════════
    # QUESTIONS
    # ═════════════════════════════════════════════════════════════════════════
    cy -= Q_GAP
    questions = [
        "1. When was your last change oil / PMS ?",
        "2. What part/s were replaced in your last service?",
        "3. Any problems with your Vehicle ATM?",
    ]
    for q in questions:
        q_w = c.stringWidth(q, "Helvetica", 8) + 5
        txt(q, LX, cy - 9, fs=8)
        hline(cy - Q_H + 3, LX + q_w, LX + CW)
        cy -= Q_H

    cy -= 4

    # ═════════════════════════════════════════════════════════════════════════
    # VEHICLE INSPECTION header
    # ═════════════════════════════════════════════════════════════════════════
    section_header("VEHICLE INSPECTION", VI_HDR_H)
    cy -= VI_GAP

    # ═════════════════════════════════════════════════════════════════════════
    # MEASURE
    # ═════════════════════════════════════════════════════════════════════════
    meas_total = MEAS_HDR_H + MEAS_COLHDR_H + MEAS_CONTENT_H
    subsection_header("MEASURE", MEAS_HDR_H, meas_total)
    col_headers(MEAS_COLHDR_H)

    # Content row (battery left, tires right)
    mh = MEAS_CONTENT_H
    for sx in (LX, RX):
        cell(sx,          cy, I_W, mh)
        cell(sx + I_W,    cy, C_W, mh)
        cell(sx + I_W + C_W, cy, A_W, mh)

    # ── TEST BATTERY ──────────────────────────────────────────────────────────
    mid_y = cy - mh / 2
    txt("TEST",    LX + I_W / 2, mid_y + 7,  bold=True, fs=10, align="center")
    txt("BATTERY", LX + I_W / 2, mid_y - 5,  bold=True, fs=10, align="center")

    bx = LX + I_W + 4
    by = cy - 12
    fs_b = 7.5
    txt("Voltage Power", bx, by, fs=fs_b)
    by -= 13; cb(bx + 3, by + 3); txt("12.6V to 12.8 V", bx + 11, by, fs=fs_b)
    by -= 11; cb(bx + 3, by + 3); txt("12.2V to 12.6 V", bx + 11, by, fs=fs_b)
    by -= 11; cb(bx + 3, by + 3); txt("12.2V",            bx + 11, by, fs=fs_b)
    by -= 15; txt("Starting Power (CCA)", bx, by, fs=fs_b)
    by -= 13; cb(bx + 3, by + 3); txt(">80%", bx + 11, by, fs=fs_b)
    by -= 11; cb(bx + 3, by + 3); txt("<80%", bx + 11, by, fs=fs_b)

    ax = LX + I_W + C_W + 4
    ay = cy - 25
    for action in ("Good", "Recharge", "Replace"):
        txt(action, ax, ay, fs=fs_b); ay -= 11
    ay = cy - 25 - 15 - 13
    txt("Good",    ax, ay, fs=fs_b); ay -= 11
    txt("Replace", ax, ay, fs=fs_b)

    # ── TIRES ─────────────────────────────────────────────────────────────────
    txt("TIRES", RX + I_W / 2, cy - mh / 2 - 11 * 0.33, bold=True, fs=11, align="center")

    tx = RX + I_W + 4
    ty = cy - 17
    fs_t = 7.5
    for condition in ("Bulges", "Side Wall Cracks", "<1.7 mm", "No Damage"):
        cb(tx + 3, ty + 3); txt(condition, tx + 11, ty, fs=fs_t)
        if condition != "No Damage":
            ty -= 10; txt("FL  FR  RL  RR", tx + 11, ty, fs=fs_t)
        ty -= 14

    tax = RX + I_W + C_W + 4
    tay = cy - 17
    for taction in ("Replace", "Replace", "Replace", "Good"):
        txt(taction, tax, tay, fs=fs_t); tay -= 24

    cy -= mh
    cy -= MEAS_GAP

    # ═════════════════════════════════════════════════════════════════════════
    # INSPECT
    # ═════════════════════════════════════════════════════════════════════════
    insp_total = INSP_HDR_H + INSP_COLHDR_H + INSP_ROW_H * 2
    subsection_header("INSPECT", INSP_HDR_H, insp_total)
    col_headers(INSP_COLHDR_H)

    def inspect_row(left_label_lines, right_label):
        nonlocal cy
        for sx in (LX, RX):
            cell(sx,              cy, I_W, INSP_ROW_H)
            cell(sx + I_W,        cy, C_W, INSP_ROW_H)
            cell(sx + I_W + C_W,  cy, A_W, INSP_ROW_H)

        # Left label (multi-line bold)
        mid = cy - INSP_ROW_H / 2
        n   = len(left_label_lines)
        lh  = 11
        start_y = mid + (n - 1) * lh / 2 + 10 * 0.33
        for line in left_label_lines:
            txt(line, LX + I_W / 2, start_y, bold=True, fs=10, align="center")
            start_y -= lh

        # Left conditions + actions
        ix = LX + I_W + 4
        iy = cy - 16
        cb(ix + 3, iy + 3); txt("Low Level",     ix + 11, iy, fs=7.5)
        iy -= 12
        cb(ix + 3, iy + 3); txt("Correct Level",  ix + 11, iy, fs=7.5)
        ax = LX + I_W + C_W + 4
        ay = cy - 16
        txt("Top Up", ax, ay, fs=7.5); ay -= 12; txt("Good", ax, ay, fs=7.5)

        # Right label
        txt(right_label, RX + I_W / 2, mid - 10 * 0.33, bold=True, fs=10, align="center")

        # Right conditions + actions
        rx2 = RX + I_W + 4
        ry  = cy - 16
        cb(rx2 + 3, ry + 3); txt("Low Level",     rx2 + 11, ry, fs=7.5)
        ry -= 12
        cb(rx2 + 3, ry + 3); txt("Correct Level",  rx2 + 11, ry, fs=7.5)
        ax2 = RX + I_W + C_W + 4
        ay2 = cy - 16
        txt("Top Up", ax2, ay2, fs=7.5); ay2 -= 12; txt("Good", ax2, ay2, fs=7.5)

        cy -= INSP_ROW_H

    inspect_row(["Coolant"],                     "Brake Fluid")
    inspect_row(["Power", "Steering", "Fluid"],  "Clutch Fuid")

    cy -= INSP_GAP

    # ═════════════════════════════════════════════════════════════════════════
    # TECHNICIAN'S COMMENT
    # ═════════════════════════════════════════════════════════════════════════
    tc_total = TC_HDR_H + TC_BOX_H
    subsection_header("TECHNICIAN'S COMMENT", TC_HDR_H, tc_total)
    # The comment area is just the interior of the rounded container (already drawn)
    cy -= TC_BOX_H

    # Footnote
    cy -= 5
    txt("**Indicate measurements", LX, cy, fs=6.5)
    cy -= NOTE_H

    # ═════════════════════════════════════════════════════════════════════════
    # DISCLAIMERS
    # ═════════════════════════════════════════════════════════════════════════
    disc_fs = 6.5
    txt("1.  THIS ACKNOWLEDGES THAT THE STORE MANAGER HAS PROPERLY CONDUCTED THE SHOW & TELL "
        "AND CLEARLY PRESENTED THE BASIC INSPECTION FROM FINDINGS",
        LX, cy, bold=True, fs=disc_fs)
    cy -= DISC_H
    txt("2.  The above articles/vehicles are received in good condition & inspection have been "
        "made to my satisfaction.", LX, cy, fs=disc_fs)
    cy -= DISC_H
    txt("3.  It is customer's responsibility to disclose all concerns of the vehicle prior to "
        "availing our services.", LX, cy, fs=disc_fs)
    cy -= SIG_GAP

    # ═════════════════════════════════════════════════════════════════════════
    # SIGNATURE LINES
    # ═════════════════════════════════════════════════════════════════════════
    sig_labels = ["Client's Printed Name and Signature", "Technician", "Store Manager"]
    sig_w   = CW * 0.27
    sig_gap = (CW - 3 * sig_w) / 2
    for i, label in enumerate(sig_labels):
        sx = LX + i * (sig_w + sig_gap)
        hline(cy, sx, sx + sig_w)
        lw = c.stringWidth(label, "Helvetica", 7)
        txt(label, sx + sig_w / 2 - lw / 2, cy - 10, fs=7)

    c.save()
    print(f"PDF saved → {filename}")


if __name__ == "__main__":
    out = "/home/user/rapide_digital_inspection/public/quick_safety_inspection_form.pdf"
    create_pdf(out)
