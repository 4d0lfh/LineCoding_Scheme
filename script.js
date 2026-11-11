
const SAMPLE = "111001011000";

const $ = id => document.getElementById(id);
const bitInput = $("bitstream");
const graphHost = $("graphs");

const schemes = [
    {
        id: "unipolar",
        title: "1. Unipolar NRZ",
        tag: "NRZ",
        description: "1 = positive; 0 = zero voltage."
    },
    {
        id: "nrzl",
        title: "2. Polar NRZ-L",
        tag: "NRZ-L",
        description: "1 = negative; 0 = positive."
    },
    {
        id: "nrziHigh",
        title: "3A. Polar NRZ-I — Initially HIGH",
        tag: "NRZ-I HIGH",
        description: "Starts positive. 1 = inversion; 0 = no inversion."
    },
    {
        id: "nrziLow",
        title: "3B. Polar NRZ-I — Initially LOW",
        tag: "NRZ-I LOW",
        description: "Starts negative. 1 = inversion; 0 = no inversion."
    },
    {
        id: "rz",
        title: "4. Polar RZ",
        tag: "RZ",
        description: "Positive for 1, negative for 0, then returns to zero."
    },
    {
        id: "manchester",
        title: "5. Polar Biphase Manchester",
        tag: "MANCHESTER",
        description: "1 = negative-to-positive; 0 = positive-to-negative."
    },
    {
        id: "diffHigh",
        title: "6A. Differential Manchester — Initially HIGH",
        tag: "DIFF. MANCHESTER HIGH",
        description: "Starts positive; always transitions mid-bit."
    },
    {
        id: "diffLow",
        title: "6B. Differential Manchester — Initially LOW",
        tag: "DIFF. MANCHESTER LOW",
        description: "Starts negative; always transitions mid-bit."
    },
    {
        id: "ami",
        title: "7. Bipolar AMI",
        tag: "AMI",
        description: "1s alternate polarity; 0s use zero voltage."
    },
    {
        id: "pseudo",
        title: "8. Bipolar Pseudoternary",
        tag: "PSEUDOTERNARY",
        description: "0s alternate polarity; 1s use zero voltage."
    }
];

// ==========================================
// 1. VALIDATE THE INPUT BITSTREAM
// ==========================================

function parseBits() {
    const raw = bitInput.value;

    $("bit-count").textContent =
        `${raw.length} ${raw.length === 1 ? "bit" : "bits"}`;

    if (raw.length === 0) {
        $("validation").textContent = "Enter your bitstream";
        return null;
    }

    if (!/^[01]+$/.test(raw)) {
        $("validation").innerHTML =
            '<span class="error">Use only 0 and 1</span>';
        return null;
    }

    $("validation").innerHTML =
        "<strong>Valid bitstream</strong>";

    return raw.split("").map(Number);
}

// ==========================================
// 2. ENCODE ALL LINE CODING SCHEMES
// ==========================================

function makeHalfLevels(bits) {
    const out = {};

    // 1. UNIPOLAR NRZ
    // 1 = positive; 0 = zero.
    out.unipolar = bits.flatMap(bit => [
        bit ? 1 : 0,
        bit ? 1 : 0
    ]);

    // 2. POLAR NRZ-L
    // 1 = negative; 0 = positive.
    out.nrzl = bits.flatMap(bit => [
        bit ? -1 : 1,
        bit ? -1 : 1
    ]);

    // 3A. POLAR NRZ-I — INITIALLY HIGH
    // 1 = inversion; 0 = no inversion.
    let levelHigh = 1;
    out.nrziHigh = [];

    bits.forEach(bit => {
        if (bit === 1) {
            levelHigh *= -1;
        }

        out.nrziHigh.push(levelHigh, levelHigh);
    });

    // 3B. POLAR NRZ-I — INITIALLY LOW
    let levelLow = -1;
    out.nrziLow = [];

    bits.forEach(bit => {
        if (bit === 1) {
            levelLow *= -1;
        }

        out.nrziLow.push(levelLow, levelLow);
    });

    // 4. POLAR RZ
    // First half carries the signal; second half returns to zero.
    out.rz = bits.flatMap(bit => [
        bit ? 1 : -1,
        0
    ]);

    // 5. POLAR BIPHASE MANCHESTER
    // 1 = negative-to-positive.
    // 0 = positive-to-negative.
    out.manchester = bits.flatMap(bit =>
        bit ? [-1, 1] : [1, -1]
    );

    // 6A. DIFFERENTIAL MANCHESTER — INITIALLY HIGH
    // 0 = transition at beginning.
    // 1 = no transition at beginning.
    // Every bit has a middle transition.
    let diffHigh = 1;
    out.diffHigh = [];

    bits.forEach(bit => {
        if (bit === 0) {
            diffHigh *= -1;
        }

        out.diffHigh.push(diffHigh);

        diffHigh *= -1;

        out.diffHigh.push(diffHigh);
    });

    // 6B. DIFFERENTIAL MANCHESTER — INITIALLY LOW
    let diffLow = -1;
    out.diffLow = [];

    bits.forEach(bit => {
        if (bit === 0) {
            diffLow *= -1;
        }

        out.diffLow.push(diffLow);

        diffLow *= -1;

        out.diffLow.push(diffLow);
    });

    // 7. BIPOLAR AMI
    // 1s alternate positive and negative.
    // 0s use zero voltage.
    let amiPolarity = -1;
    out.ami = [];

    bits.forEach(bit => {
        if (bit === 1) {
            amiPolarity *= -1;
            out.ami.push(amiPolarity, amiPolarity);
        } else {
            out.ami.push(0, 0);
        }
    });

    // 8. BIPOLAR PSEUDOTERNARY
    // 0s alternate positive and negative.
    // 1s use zero voltage.
    let pseudoPolarity = -1;
    out.pseudo = [];

    bits.forEach(bit => {
        if (bit === 0) {
            pseudoPolarity *= -1;
            out.pseudo.push(pseudoPolarity, pseudoPolarity);
        } else {
            out.pseudo.push(0, 0);
        }
    });

    return out;
}

// ==========================================
// 3. DRAW THE WAVEFORM
// ==========================================

function renderGraph(bits, levels, scheme, options) {
    const n = bits.length;

    // Widen the graph when more bits are entered.
    const W = Math.max(800, n * 54);

    const left = options.showVoltage ? 45 : 15;
    const right = 12;

    const plotTop = options.showBits ? 35 : 18;
    const plotBottom = 130;

    const plotH = plotBottom - plotTop;
    const plotW = W - left - right;
    const bitW = plotW / n;

    function y(value) {
        if (value === 1) return plotTop + 16;
        if (value === -1) return plotBottom - 16;
        return plotTop + plotH / 2;
    }

    const grid = [];

    // Vertical bit boundaries and voltage reference lines.
    if (options.showGrid) {
        for (let i = 0; i <= n; i++) {
            const x = left + i * bitW;

            grid.push(`
                <line
                    x1="${x}" y1="${plotTop}"
                    x2="${x}" y2="${plotBottom}"
                    stroke="#e0e7f1"
                    stroke-dasharray="3 4"
                />
            `);
        }

        [
            plotTop + 16,
            plotTop + plotH / 2,
            plotBottom - 16
        ].forEach((yy, i) => {
            grid.push(`
                <line
                    x1="${left}" y1="${yy}"
                    x2="${W - right}" y2="${yy}"
                    stroke="${i === 1 ? "#9eabc0" : "#edf0f5"}"
                />
            `);
        });
    } else {
        grid.push(`
            <line
                x1="${left}" y1="${plotTop + plotH / 2}"
                x2="${W - right}" y2="${plotTop + plotH / 2}"
                stroke="#c9d2e0"
            />
        `);
    }

    // Voltage labels.
    if (options.showVoltage) {
        grid.push(`
            <text
                x="${left - 10}"
                y="${plotTop + 20}"
                text-anchor="end"
                font-size="12"
                fill="#34415a">+</text>

            <text
                x="${left - 10}"
                y="${plotTop + plotH / 2 + 4}"
                text-anchor="end"
                font-size="12"
                fill="#34415a">0</text>

            <text
                x="${left - 10}"
                y="${plotBottom - 12}"
                text-anchor="end"
                font-size="12"
                fill="#34415a">−</text>
        `);
    }

    // Display input bits above their intervals.
    if (options.showBits) {
        bits.forEach((bit, i) => {
            grid.push(`
                <text
                    x="${left + (i + 0.5) * bitW}"
                    y="20"
                    text-anchor="middle"
                    font-size="13"
                    font-weight="bold"
                    fill="#34415a">${bit}</text>
            `);
        });
    }

    // ==========================================
    // 4. BUILD THE SIGNAL PATH
    // ==========================================

    const isNRZI =
        scheme.id === "nrziHigh" ||
        scheme.id === "nrziLow";

    const isDiffManchester =
        scheme.id === "diffHigh" ||
        scheme.id === "diffLow";

    const hasInitialReference = isNRZI || isDiffManchester;

    const initialLevel =
        scheme.id === "nrziHigh" ||
        scheme.id === "diffHigh"
            ? 1
            : -1;

    let path = "";

    levels.forEach((value, i) => {
        const x1 = left + (i / 2) * bitW;
        const x2 = left + ((i + 1) / 2) * bitW;
        const currentY = y(value);

        if (i === 0) {
            if (hasInitialReference) {
                // Draw the initial reference level and the
                // first transition, if one occurs.
                path =
                    `M ${x1} ${y(initialLevel)}` +
                    ` L ${x1} ${currentY}` +
                    ` L ${x2} ${currentY}`;
            } else {
                path = `M ${x1} ${currentY} L ${x2} ${currentY}`;
            }
        } else {
            const previousY = y(levels[i - 1]);

            path +=
                ` L ${x1} ${previousY}` +
                ` L ${x1} ${currentY}` +
                ` L ${x2} ${currentY}`;
        }
    });

    const signal = `
        <path
            d="${path}"
            fill="none"
            stroke="#1769e0"
            stroke-width="2.8"
            stroke-linejoin="round"
            stroke-linecap="round"
        />
    `;

    // ==========================================
    // 5. INVERSION CIRCLES
    // ==========================================

    const transitionCircles = [];
    const showDecisions = isNRZI || isDiffManchester;

    if (showDecisions) {
        bits.forEach((bit, i) => {
            // Exact X-coordinate of the beginning of this bit.
            const boundaryX = left + i * bitW;

            // NRZ-I: 1 = inversion; 0 = no inversion.
            // Differential Manchester:
            // 0 = beginning transition; 1 = no beginning transition.
            const invert = isNRZI
                ? bit === 1
                : bit === 0;

            const currentLevel = levels[i * 2];

            const previousLevel = i === 0
                ? initialLevel
                : levels[i * 2 - 1];

            
if (invert) {
    // FILLED BLACK POINT:
    // Place it at the exact corner where inversion begins.
    const previousY = y(previousLevel);

    transitionCircles.push(`
        <circle
            cx="${boundaryX}"
            cy="${previousY}"
            r="4"
            fill="#111827"
            stroke="#111827"
            stroke-width="1.5"
        />
    `);
} else {
    // HOLLOW CIRCLE:
    // No inversion; place it on the horizontal signal line.
    transitionCircles.push(`
        <circle
            cx="${boundaryX}"
            cy="${y(currentLevel)}"
            r="5"
            fill="#ffffff"
            stroke="#111827"
            stroke-width="2"
        />
    `);
}

        });
    }

    // Bit labels beneath the waveform.
    const bitLabels = bits.map((bit, i) => `
        <text
            x="${left + (i + 0.5) * bitW}"
            y="${plotBottom + 20}"
            text-anchor="middle"
            font-size="12"
            fill="${bit ? "#2459d3" : "#62708a"}">
            ${bit}
        </text>
    `).join("");

    const height = showDecisions ? 175 : 162;

    return `
        <svg
            class="wave"
            viewBox="0 0 ${W} ${height}"
            role="img"
            aria-label="${scheme.title} waveform">

            ${grid.join("")}
            ${signal}
            ${transitionCircles.join("")}
            ${bitLabels}

        </svg>
    `;
}

// ==========================================
// 6. RENDER ALL 10 GRAPHS
// ==========================================

function render() {
    const bits = parseBits();

    if (!bits) {
        graphHost.innerHTML = `
            <div class="panel empty">
                Enter one or more binary digits (0 or 1).
            </div>
        `;
        return;
    }

    const levels = makeHalfLevels(bits);

    const options = {
        showGrid: $("showGrid").checked,
        showBits: $("showBits").checked,
        showVoltage: $("showVoltage").checked
    };

    graphHost.innerHTML = schemes.map(scheme => `
        <article class="scheme-card">

            <div class="scheme-top">
                <div>
                    <h3>${scheme.title}</h3>
                    <p>${scheme.description}</p>
                </div>

                <span class="scheme-tag">${scheme.tag}</span>
            </div>

            <div class="graph-wrap">
                ${renderGraph(
                    bits,
                    levels[scheme.id],
                    scheme,
                    options
                )}
            </div>

        </article>
    `).join("");
}

// ==========================================
// 7. BUTTONS AND INPUT EVENTS
// ==========================================

// Encode the current bitstream.
$("encodeBtn").addEventListener("click", render);

// Load the sample bitstream.
$("sampleBtn").addEventListener("click", () => {
    bitInput.value = SAMPLE;
    render();
});

// Generate random bits using the current input length,
// or 20 bits if the input is empty.
$("randomBtn").addEventListener("click", () => {
    const length = bitInput.value.length || 20;

    bitInput.value = Array.from(
        { length },
        () => Math.random() < 0.5 ? "0" : "1"
    ).join("");

    render();
});

// Clear the bitstream.
$("clearBtn").addEventListener("click", () => {
    bitInput.value = "";
    render();
});

// Allow only 0 and 1.
bitInput.addEventListener("input", () => {
    bitInput.value = bitInput.value.replace(/[^01]/g, "");
    render();
});

// Redraw when display options change.
[
    "showGrid",
    "showBits",
    "showVoltage"
].forEach(id => {
    $(id).addEventListener("change", render);
});

// Display the initial graphs.
render();
