'use strict';

// =====================================================================
//  ESTADO GLOBAL DE LA SIMULACIÓN
// =====================================================================

const estadoSimulacion = {
    bitsOriginales: [],          // Los 4 bits de datos ingresados por el usuario [D1, D2, D3, D4]
    palabraCodigo: [],           // Los 7 bits de la palabra codificada [P1, P2, D1, P4, D2, D3, D4]
    palabraConError: [],         // La palabra código después de introducir un error
    posicionDelError: -1,        // Posición (1-7) donde ocurrió el error, -1 si no hay error
    sindromeCalculado: [],       // Los 3 bits del síndrome [S1, S2, S4]
    pasoActualParidad: 0,        // Controla cuál paso de paridad se está mostrando
    totalPasosParidad: 3,        // Siempre hay 3 bits de paridad que calcular
    faseCodificacionCompleta: false,
};

// =====================================================================
//  ESTADO DE LA SIMULACIÓN VISUAL
// =====================================================================

const estadoChat = {
    transmitiendo: false,
};

// =====================================================================
//  FUNCIONES DE LÓGICA DEL CÓDIGO HAMMING
// =====================================================================

function calcularBitsDeParidad(bitsDeEntrada) {
    const [d1, d2, d3, d4] = bitsDeEntrada;

    const bitDeParidadUno    = d1 ^ d2 ^ d4;  // P1 cubre posiciones 1,3,5,7
    const bitDeParidadDos    = d1 ^ d3 ^ d4;  // P2 cubre posiciones 2,3,6,7
    const bitDeParidadCuatro = d2 ^ d3 ^ d4;  // P4 cubre posiciones 4,5,6,7

    return [bitDeParidadUno, bitDeParidadDos, bitDeParidadCuatro];
}

function construirPalabraCodigo(bitsDeEntrada, bitsDeParidad) {
    const [d1, d2, d3, d4] = bitsDeEntrada;
    const [p1, p2, p4] = bitsDeParidad;

    // Estructura del código Hamming (7,4):
    // Posición: 1  2  3  4  5  6  7
    // Contenido: P1 P2 D1 P4 D2 D3 D4
    return [p1, p2, d1, p4, d2, d3, d4];
}

function introducirErrorEnPosicion(palabraOriginal, posicion) {
    // posicion es 1-indexada (1 a 7)
    const palabraModificada = [...palabraOriginal];
    const indice = posicion - 1;
    palabraModificada[indice] = palabraModificada[indice] === 0 ? 1 : 0;
    return palabraModificada;
}

function calcularSindrome(palabraRecibida) {
    const [r1, r2, r3, r4, r5, r6, r7] = palabraRecibida;

    // Cada bit del síndrome verifica un subconjunto de posiciones
    const sindromeS1 = r1 ^ r3 ^ r5 ^ r7;  // Posiciones 1, 3, 5, 7
    const sindromeS2 = r2 ^ r3 ^ r6 ^ r7;  // Posiciones 2, 3, 6, 7
    const sindromeS4 = r4 ^ r5 ^ r6 ^ r7;  // Posiciones 4, 5, 6, 7

    return [sindromeS1, sindromeS2, sindromeS4];
}

function detectarError(sindromeCalculado) {
    const [s1, s2, s4] = sindromeCalculado;
    // El síndrome da directamente la posición del error en binario: S4 S2 S1
    const posicionDelError = s4 * 4 + s2 * 2 + s1 * 1;
    return posicionDelError; // 0 = sin error, 1-7 = posición con error
}

function corregirBit(palabraConError, posicionDelError) {
    if (posicionDelError === 0) return [...palabraConError];
    const palabraCorregida = [...palabraConError];
    const indice = posicionDelError - 1;
    palabraCorregida[indice] = palabraCorregida[indice] === 0 ? 1 : 0;
    return palabraCorregida;
}

function extraerBitsDeDatos(palabraCorregida) {
    // Los datos están en posiciones 3, 5, 6, 7 (índices 2, 4, 5, 6)
    return [palabraCorregida[2], palabraCorregida[4], palabraCorregida[5], palabraCorregida[6]];
}

// =====================================================================
//  VALIDACIÓN DE ENTRADA
// =====================================================================

function validarEntradaDeBits() {
    const campoD1 = document.getElementById('entrada-d1');
    const campoD2 = document.getElementById('entrada-d2');
    const campoD3 = document.getElementById('entrada-d3');
    const campoD4 = document.getElementById('entrada-d4');
    const divMensajeError = document.getElementById('mensaje-error-entrada');

    const valorD1 = parseInt(campoD1.value);
    const valorD2 = parseInt(campoD2.value);
    const valorD3 = parseInt(campoD3.value);
    const valorD4 = parseInt(campoD4.value);

    const todosValidos = [valorD1, valorD2, valorD3, valorD4].every(
        valor => !isNaN(valor) && (valor === 0 || valor === 1)
    );

    if (!todosValidos) {
        divMensajeError.textContent = 'Error: Cada campo debe contener únicamente el valor 0 o 1.';
        divMensajeError.style.display = 'block';
        return null;
    }

    divMensajeError.style.display = 'none';
    return [valorD1, valorD2, valorD3, valorD4];
}

// =====================================================================
//  FUNCIONES DE RENDERIZADO (DOM)
// =====================================================================

function crearBloqueDebit(valorDelBit, etiqueta, tipoDeBit, posicion) {
    const contenedorBloque = document.createElement('div');
    contenedorBloque.className = 'bloque-bit';

    const etiquetaElemento = document.createElement('div');
    etiquetaElemento.className = 'etiqueta-bloque';
    etiquetaElemento.textContent = etiqueta;

    const valorElemento = document.createElement('div');
    valorElemento.className = `valor-bit tipo-${tipoDeBit}`;
    valorElemento.textContent = valorDelBit;
    valorElemento.id = `bit-posicion-${posicion}`;

    const posicionElemento = document.createElement('div');
    posicionElemento.className = 'posicion-bloque';
    posicionElemento.textContent = `pos ${posicion}`;

    contenedorBloque.appendChild(etiquetaElemento);
    contenedorBloque.appendChild(valorElemento);
    contenedorBloque.appendChild(posicionElemento);

    return contenedorBloque;
}

function renderizarPalabraCodigo(palabra, contenedorId, posicionResaltada, estadoResaltado) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const etiquetasPorPosicion = ['P1', 'P2', 'D1', 'P4', 'D2', 'D3', 'D4'];
    const tiposPorPosicion     = ['paridad', 'paridad', 'dato', 'paridad', 'dato', 'dato', 'dato'];

    contenedor.innerHTML = '';

    const filaVisualizacion = document.createElement('div');
    filaVisualizacion.className = 'contenedor-bits-visualizacion';

    palabra.forEach((valorBit, indice) => {
        const posicion = indice + 1;
        const bloque = crearBloqueDebit(
            valorBit,
            etiquetasPorPosicion[indice],
            tiposPorPosicion[indice],
            posicion
        );

        bloque.style.animationDelay = `${indice * 60}ms`;
        bloque.classList.add('apareciendo');

        filaVisualizacion.appendChild(bloque);
    });

    contenedor.appendChild(filaVisualizacion);

    if (posicionResaltada && posicionResaltada > 0) {
        setTimeout(() => {
            const elementoBitResaltado = document.getElementById(`bit-posicion-${posicionResaltada}`);
            if (elementoBitResaltado) {
                elementoBitResaltado.className = `valor-bit estado-${estadoResaltado}`;
            }
        }, 100);
    }
}

function construirPasoDeParidad(numeroPaso, nombreParidad, formula, bitsInvolucrados, resultado) {
    const divPaso = document.createElement('div');
    divPaso.className = 'paso-paridad';
    divPaso.id = `paso-paridad-${numeroPaso}`;

    const tituloDiv = document.createElement('div');
    tituloDiv.className = 'titulo-paso-paridad';

    const iconoPaso = document.createElement('span');
    iconoPaso.className = 'icono-paso';
    iconoPaso.textContent = numeroPaso;

    tituloDiv.appendChild(iconoPaso);
    tituloDiv.appendChild(document.createTextNode(`Calculando ${nombreParidad}`));
    divPaso.appendChild(tituloDiv);

    const formulaDiv = document.createElement('div');
    formulaDiv.className = 'formula-paso';
    formulaDiv.innerHTML = formula;
    divPaso.appendChild(formulaDiv);

    return divPaso;
}

function generarFormulaPasoPareidad(nombreParidad, nombresOperandos, valoresOperandos, resultado) {
    const partesFormula = nombresOperandos.map((nombre, indice) => {
        return `<span class="operando">${nombre}(${valoresOperandos[indice]})</span>`;
    });

    const formulaXor = partesFormula.join(' <span class="operador-xor">⊕</span> ');
    return `${nombreParidad} = ${formulaXor} = <span class="resultado">${resultado}</span>`;
}

// =====================================================================
//  CONTROL DEL FLUJO DE LA APLICACIÓN
// =====================================================================

function iniciarCodificacion() {
    const bitsValidados = validarEntradaDeBits();
    if (!bitsValidados) return;

    // Guardar datos en el estado global
    estadoSimulacion.bitsOriginales = bitsValidados;
    estadoSimulacion.pasoActualParidad = 0;
    estadoSimulacion.faseCodificacionCompleta = false;
    estadoSimulacion.posicionDelError = -1;

    // Calcular y almacenar la palabra código
    const bitsDeParidad = calcularBitsDeParidad(bitsValidados);
    estadoSimulacion.palabraCodigo = construirPalabraCodigo(bitsValidados, bitsDeParidad);
    estadoSimulacion.palabraConError = [...estadoSimulacion.palabraCodigo];

    // Preparar los pasos de paridad en el DOM
    prepararPasosDeParidad(bitsValidados, bitsDeParidad);

    // Mostrar la sección de cálculo de paridad
    mostrarSeccion('seccion-calculo-paridad');

    // Ocultar botón de iniciar y mostrar reiniciar
    document.getElementById('boton-iniciar').style.display = 'none';
    document.getElementById('boton-reiniciar').style.display = 'inline-block';

    // Mostrar el primer paso automáticamente
    mostrarSiguientePaso();
}

function prepararPasosDeParidad(bitsDeEntrada, bitsDeParidad) {
    const contenedorPasos = document.getElementById('contenedor-pasos-paridad');
    contenedorPasos.innerHTML = '';

    const [d1, d2, d3, d4] = bitsDeEntrada;
    const [p1, p2, p4] = bitsDeParidad;

    const configuracionPasos = [
        {
            numeroPaso: 1,
            nombreParidad: 'P1 (Bit de Paridad 1)',
            nombresOperandos: ['D1', 'D2', 'D4'],
            valoresOperandos: [d1, d2, d4],
            resultado: p1,
        },
        {
            numeroPaso: 2,
            nombreParidad: 'P2 (Bit de Paridad 2)',
            nombresOperandos: ['D1', 'D3', 'D4'],
            valoresOperandos: [d1, d3, d4],
            resultado: p2,
        },
        {
            numeroPaso: 3,
            nombreParidad: 'P4 (Bit de Paridad 4)',
            nombresOperandos: ['D2', 'D3', 'D4'],
            valoresOperandos: [d2, d3, d4],
            resultado: p4,
        },
    ];

    configuracionPasos.forEach(config => {
        const formulaHtml = generarFormulaPasoPareidad(
            config.nombreParidad.split(' ')[0],
            config.nombresOperandos,
            config.valoresOperandos,
            config.resultado
        );
        const divPaso = construirPasoDeParidad(
            config.numeroPaso,
            config.nombreParidad,
            formulaHtml,
            config.valoresOperandos,
            config.resultado
        );
        contenedorPasos.appendChild(divPaso);
    });
}

function mostrarSiguientePaso() {
    estadoSimulacion.pasoActualParidad++;
    const numeroPaso = estadoSimulacion.pasoActualParidad;

    const divPaso = document.getElementById(`paso-paridad-${numeroPaso}`);
    if (divPaso) {
        divPaso.classList.add('visible');
    }

    // Si ya se mostraron los 3 pasos, mostrar la palabra código completa
    if (numeroPaso >= estadoSimulacion.totalPasosParidad) {
        document.getElementById('contenedor-boton-siguiente').style.display = 'none';
        estadoSimulacion.faseCodificacionCompleta = true;
        mostrarPalabraCodigoCompleta();
    }
}

function mostrarPalabraCodigoCompleta() {
    const seccionPalabra = document.getElementById('seccion-palabra-codigo');
    const contenedorPalabra = document.getElementById('contenedor-palabra-codigo');

    // Separador descriptivo
    const separador = document.createElement('div');
    separador.className = 'separador-bits';
    separador.textContent = 'Palabra código de 7 bits (posición → valor)';
    contenedorPalabra.appendChild(separador);

    mostrarSeccion('seccion-palabra-codigo');
    renderizarPalabraCodigo(estadoSimulacion.palabraCodigo, 'contenedor-palabra-codigo', -1, '');
}

function simularErrorAleatorio() {
    // Elegir una posición aleatoria del 1 al 7
    const posicionAleatoria = Math.floor(Math.random() * 7) + 1;
    estadoSimulacion.posicionDelError = posicionAleatoria;
    estadoSimulacion.palabraConError = introducirErrorEnPosicion(
        estadoSimulacion.palabraCodigo,
        posicionAleatoria
    );

    // Actualizar la visualización de la palabra código mostrando el error en rojo
    const contenedorPalabra = document.getElementById('contenedor-palabra-codigo');
    contenedorPalabra.innerHTML = '';

    const alertaError = document.createElement('div');
    alertaError.className = 'alerta-error-simulado';
    alertaError.innerHTML = `<span class="icono">⚠</span> Se introdujo un error en la posición <strong>${posicionAleatoria}</strong>. ¡El bit fue invertido!`;
    contenedorPalabra.appendChild(alertaError);

    renderizarPalabraCodigo(
        estadoSimulacion.palabraConError,
        'contenedor-palabra-codigo',
        posicionAleatoria,
        'error'
    );

    // Ocultar el botón de simular error para evitar múltiples errores
    document.getElementById('boton-simular-error').style.display = 'none';

    // Mostrar la sección de detección
    mostrarSeccionDeteccion();
}

function mostrarSeccionDeteccion() {
    const sindromeCalculado = calcularSindrome(estadoSimulacion.palabraConError);
    estadoSimulacion.sindromeCalculado = sindromeCalculado;

    const posicionDetectada = detectarError(sindromeCalculado);
    const contenedorDeteccion = document.getElementById('contenedor-deteccion');
    contenedorDeteccion.innerHTML = '';

    const [s1, s2, s4] = sindromeCalculado;
    const [r1, r2, r3, r4, r5, r6, r7] = estadoSimulacion.palabraConError;

    // Tabla de cálculo del síndrome
    const tablaSindrome = document.createElement('table');
    tablaSindrome.className = 'tabla-sindrome';

    const encabezado = tablaSindrome.createTHead();
    const filaEncabezado = encabezado.insertRow();
    ['Bit de Síndrome', 'Posiciones que Verifica', 'Cálculo XOR', 'Resultado'].forEach(texto => {
        const th = document.createElement('th');
        th.textContent = texto;
        filaEncabezado.appendChild(th);
    });

    const cuerpo = tablaSindrome.createTBody();

    const filasDeSindrome = [
        {
            nombre: 'S1',
            posiciones: '1, 3, 5, 7',
            calculo: `${r1} ⊕ ${r3} ⊕ ${r5} ⊕ ${r7}`,
            resultado: s1
        },
        {
            nombre: 'S2',
            posiciones: '2, 3, 6, 7',
            calculo: `${r2} ⊕ ${r3} ⊕ ${r6} ⊕ ${r7}`,
            resultado: s2
        },
        {
            nombre: 'S4',
            posiciones: '4, 5, 6, 7',
            calculo: `${r4} ⊕ ${r5} ⊕ ${r6} ⊕ ${r7}`,
            resultado: s4
        },
    ];

    filasDeSindrome.forEach(filaDatos => {
        const fila = cuerpo.insertRow();
        const celdaNombre = fila.insertCell();
        celdaNombre.textContent = filaDatos.nombre;
        celdaNombre.style.fontWeight = '700';
        celdaNombre.style.color = 'var(--cyan-suave)';

        const celdaPosiciones = fila.insertCell();
        celdaPosiciones.textContent = filaDatos.posiciones;

        const celdaCalculo = fila.insertCell();
        celdaCalculo.textContent = filaDatos.calculo;
        celdaCalculo.style.fontFamily = 'monospace';

        const celdaResultado = fila.insertCell();
        celdaResultado.textContent = filaDatos.resultado;
        celdaResultado.className = `celda-sindrome-resultado celda-sindrome-${filaDatos.resultado === 1 ? 'uno' : 'cero'}`;
    });

    contenedorDeteccion.appendChild(tablaSindrome);

    // Panel del síndrome calculado
    const panelSindrome = document.createElement('div');
    panelSindrome.className = 'panel-sindrome';

    const etiquetaSindrome = document.createElement('div');
    etiquetaSindrome.className = 'etiqueta-sindrome';
    etiquetaSindrome.textContent = 'Síndrome (S4 S2 S1):';

    const contenedorBitsSindrome = document.createElement('div');
    contenedorBitsSindrome.className = 'valor-sindrome';

    [s4, s2, s1].forEach(bitSindrome => {
        const divBit = document.createElement('div');
        divBit.className = `bit-sindrome ${bitSindrome === 1 ? 'sindrome-uno' : 'sindrome-cero'}`;
        divBit.textContent = bitSindrome;
        contenedorBitsSindrome.appendChild(divBit);
    });

    const textoResultado = document.createElement('div');
    textoResultado.className = `resultado-sindrome ${posicionDetectada > 0 ? 'con-error' : 'sin-error'}`;

    if (posicionDetectada > 0) {
        textoResultado.textContent = `Síndrome = ${s4 * 4 + s2 * 2 + s1} → Error detectado en la posición ${posicionDetectada}`;
    } else {
        textoResultado.textContent = 'Síndrome = 0 → Sin error detectado';
    }

    panelSindrome.appendChild(etiquetaSindrome);
    panelSindrome.appendChild(contenedorBitsSindrome);
    panelSindrome.appendChild(textoResultado);
    contenedorDeteccion.appendChild(panelSindrome);

    mostrarSeccion('seccion-deteccion');
}

function corregirError() {
    const posicionDetectada = detectarError(estadoSimulacion.sindromeCalculado);
    const palabraCorregida = corregirBit(estadoSimulacion.palabraConError, posicionDetectada);
    const bitsRecuperados = extraerBitsDeDatos(palabraCorregida);

    const contenedorCorreccion = document.getElementById('contenedor-correccion');
    contenedorCorreccion.innerHTML = '';

    // Mostrar la palabra corregida con el bit resaltado en verde
    const etiquetaPalabraCorregida = document.createElement('h3');
    etiquetaPalabraCorregida.style.cssText = 'font-size:14px; color:var(--gris-claro); margin-bottom:8px; font-weight:400;';
    etiquetaPalabraCorregida.textContent = 'Palabra código con el error corregido:';
    contenedorCorreccion.appendChild(etiquetaPalabraCorregida);

    renderizarPalabraCodigo(
        palabraCorregida,
        'contenedor-correccion',
        posicionDetectada > 0 ? posicionDetectada : -1,
        'corregido'
    );

    // Panel de éxito con los bits recuperados
    setTimeout(() => {
        const panelExito = document.createElement('div');
        panelExito.className = 'panel-exito';

        panelExito.innerHTML = `
            <div class="icono-exito">✓</div>
            <div class="titulo-exito">¡Mensaje Recuperado Correctamente!</div>
            <div class="mensaje-exito">
                El error en la posición <strong>${posicionDetectada}</strong> fue corregido exitosamente.
                Los 4 bits de datos originales han sido recuperados:
            </div>
        `;

        const contenedorBitsRecuperados = document.createElement('div');
        contenedorBitsRecuperados.className = 'bits-recuperados';

        const etiquetasDatos = ['D1', 'D2', 'D3', 'D4'];
        bitsRecuperados.forEach((valorBit, indice) => {
            const divBit = document.createElement('div');
            divBit.className = 'bit-recuperado';
            divBit.innerHTML = `
                <div class="etiqueta">${etiquetasDatos[indice]}</div>
                <div class="valor">${valorBit}</div>
            `;
            contenedorBitsRecuperados.appendChild(divBit);
        });

        panelExito.appendChild(contenedorBitsRecuperados);

        const verificacionDiv = document.createElement('p');
        verificacionDiv.style.cssText = 'margin-top:14px; font-size:13px; color:var(--gris-claro);';
        const bitsCoinciden = bitsRecuperados.every((bit, i) => bit === estadoSimulacion.bitsOriginales[i]);
        verificacionDiv.textContent = bitsCoinciden
            ? `Verificación: [${bitsRecuperados.join(', ')}] coincide con los datos originales [${estadoSimulacion.bitsOriginales.join(', ')}] ✓`
            : `Advertencia: Los datos recuperados [${bitsRecuperados.join(', ')}] difieren de los originales [${estadoSimulacion.bitsOriginales.join(', ')}]`;
        verificacionDiv.style.color = bitsCoinciden ? 'var(--verde-exito)' : 'var(--amarillo-advertencia)';
        panelExito.appendChild(verificacionDiv);

        contenedorCorreccion.appendChild(panelExito);
    }, 600);

    // Ocultar el botón de corregir
    document.getElementById('boton-corregir').style.display = 'none';
    mostrarSeccion('seccion-correccion');
}

function reiniciarSimulacion() {
    // Limpiar el estado global
    estadoSimulacion.bitsOriginales = [];
    estadoSimulacion.palabraCodigo = [];
    estadoSimulacion.palabraConError = [];
    estadoSimulacion.posicionDelError = -1;
    estadoSimulacion.sindromeCalculado = [];
    estadoSimulacion.pasoActualParidad = 0;
    estadoSimulacion.faseCodificacionCompleta = false;

    // Ocultar todas las secciones excepto la de entrada
    ['seccion-calculo-paridad', 'seccion-palabra-codigo', 'seccion-deteccion', 'seccion-correccion'].forEach(id => {
        const seccion = document.getElementById(id);
        if (seccion) {
            seccion.classList.add('oculto');
            seccion.classList.remove('apareciendo');
        }
    });

    // Restaurar botones
    document.getElementById('boton-iniciar').style.display = 'inline-block';
    document.getElementById('boton-reiniciar').style.display = 'none';
    document.getElementById('contenedor-boton-siguiente').style.display = 'flex';
    document.getElementById('boton-simular-error').style.display = 'inline-block';
    document.getElementById('boton-corregir').style.display = 'inline-block';

    // Limpiar contenidos dinámicos
    document.getElementById('contenedor-pasos-paridad').innerHTML = '';
    document.getElementById('contenedor-palabra-codigo').innerHTML = '';
    document.getElementById('contenedor-deteccion').innerHTML = '';
    document.getElementById('contenedor-correccion').innerHTML = '';
    document.getElementById('mensaje-error-entrada').style.display = 'none';
}

// =====================================================================
//  UTILIDADES DE INTERFAZ
// =====================================================================

function mostrarSeccion(idSeccion) {
    const seccion = document.getElementById(idSeccion);
    if (!seccion) return;

    seccion.classList.remove('oculto');
    seccion.classList.add('apareciendo');

    // Hacer scroll suave hacia la sección
    setTimeout(() => {
        seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// =====================================================================
//  SIMULACIÓN VISUAL — CELULARES
// =====================================================================

function obtenerNumeroValidado() {
    const campo = document.getElementById('entrada-numero-visual');
    const divError = document.getElementById('visual-mensaje-error');
    const valor = parseInt(campo.value);

    if (isNaN(valor) || valor < 1 || valor > 7) {
        divError.textContent = 'Escribe un número entero del 1 al 7.';
        divError.style.display = 'block';
        return null;
    }
    divError.style.display = 'none';
    return valor;
}

function numeroA4Bits(n) {
    // 5 → [0, 1, 0, 1]
    return n.toString(2).padStart(4, '0').split('').map(Number);
}

function introducirErrorBit(bits) {
    const pos = Math.floor(Math.random() * bits.length);
    const resultado = [...bits];
    resultado[pos] = resultado[pos] === 0 ? 1 : 0;
    return { bitsConError: resultado, posicion: pos + 1 };
}

function renderBits(bits, posResaltada, clsResaltado) {
    // posResaltada: 1-indexed; clsResaltado: 'err' | 'fix'
    return bits.map((b, i) =>
        `<span class="${posResaltada === i + 1 ? clsResaltado : (b === 1 ? 'b1' : 'b0')}">${b}</span>`
    ).join('');
}

function agregarBurbujaEmisora(texto) {
    const pantalla = document.getElementById('chat-emisor');
    const div = document.createElement('div');
    div.className = 'burbuja-chat burbuja-saliente';
    div.textContent = texto;
    pantalla.appendChild(div);
    pantalla.scrollTop = pantalla.scrollHeight;
}

function agregarBurbujaReceptora(texto, estado, info) {
    const pantalla = document.getElementById('chat-receptor');
    const div = document.createElement('div');
    div.className = 'burbuja-chat burbuja-entrante';

    if (estado === 'corrompido') {
        div.classList.add('burbuja-corrompida');
        div.innerHTML = `❌ ${texto}<span class="burbuja-info">Mensaje corrompido</span>`;
    } else if (estado === 'corregido') {
        div.classList.add('burbuja-corregida');
        div.innerHTML = `✓ ${texto}<span class="burbuja-info">Error detectado y corregido en posición ${info}</span>`;
    } else {
        div.textContent = texto;
    }

    pantalla.appendChild(div);
    pantalla.scrollTop = pantalla.scrollHeight;
}

function activarOndas(modo) {
    const contenedor = document.getElementById('ondas-contenedor');
    contenedor.classList.remove('ondas-error', 'ondas-hamming');
    if (modo === 'error')   contenedor.classList.add('ondas-error');
    if (modo === 'hamming') contenedor.classList.add('ondas-hamming');
}

function mostrarIconoCanal(icono) {
    document.getElementById('canal-icono').textContent = icono;
}

function activarInterferencia(activa) {
    const canal = document.getElementById('canal-transmision');
    if (activa) canal.classList.add('interferencia-activa');
    else        canal.classList.remove('interferencia-activa');
}

function bloquearBotonesVisual(bloqueado) {
    document.querySelector('.boton-sin-proteccion').disabled = bloqueado;
    document.querySelector('.boton-con-hamming').disabled    = bloqueado;
    estadoChat.transmitiendo = bloqueado;
}

// ----- Paneles de información binaria -----

function mostrarPanelEmisor(numero, bits4, modo, palabraCodigo) {
    const panel = document.getElementById('panel-emisor-info');

    const etqDatos = ['D1','D2','D3','D4'];
    const tablaDatos = `<div class="bit-tabla">
        <div class="bit-tabla-fila etq">${etqDatos.map(e => `<span>${e}</span>`).join('')}</div>
        <div class="bit-tabla-fila">${bits4.map(b => `<span class="${b ? 'b1' : 'b0'}">${b}</span>`).join('')}</div>
    </div>`;

    let bloqueHamming = '';
    if (modo === 'hamming' && palabraCodigo) {
        const etq7     = ['P1','P2','D1','P4','D2','D3','D4'];
        const tiposPos = ['p','p','d','p','d','d','d'];
        bloqueHamming = `
            <div class="panel-separador"></div>
            <div class="panel-subtitulo">Codificado → 7 bits:</div>
            <div class="bit-tabla">
                <div class="bit-tabla-fila etq">${etq7.map(e => `<span>${e}</span>`).join('')}</div>
                <div class="bit-tabla-fila">${palabraCodigo.map((b, i) =>
                    `<span class="bt-${tiposPos[i]}">${b}</span>`).join('')}
                </div>
            </div>`;
    }

    const estadoHtml = modo === 'hamming'
        ? `<div class="panel-estado ok">🛡️ Paridad calculada y añadida.</div>`
        : `<div class="panel-estado advertencia">⚠️ Sin bits de verificación.</div>`;

    panel.innerHTML = `
        <div class="panel-info-titulo">📤 Enviando</div>
        <div class="panel-info-scroll">
            <div class="panel-subtitulo">Número → 4 bits de datos</div>
            <div class="panel-numero-grande">${numero}</div>
            ${tablaDatos}
            ${bloqueHamming}
            <div class="panel-separador"></div>
            ${estadoHtml}
        </div>`;
}

function mostrarPanelReceptor(bits4orig, bitsRecibidos, posErrorBit, modo, sindrome, posErrorHamming, palabraCorregida) {
    const panel = document.getElementById('panel-receptor-info');

    if (modo === 'corrompido') {
        const etqDatos = ['D1','D2','D3','D4'];
        const tablaBits = `<div class="bit-tabla">
            <div class="bit-tabla-fila etq">${etqDatos.map(e => `<span>${e}</span>`).join('')}</div>
            <div class="bit-tabla-fila">${renderBits(bitsRecibidos, posErrorBit, 'err')}</div>
        </div>`;
        const numOrig   = parseInt(bits4orig.join(''), 2);
        const numRecib  = parseInt(bitsRecibidos.join(''), 2);

        panel.innerHTML = `
            <div class="panel-info-titulo">📥 Recibido</div>
            <div class="panel-info-scroll">
                <div class="panel-subtitulo">4 bits llegados:</div>
                ${tablaBits}
                <div class="panel-nota-error">bit ${posErrorBit} alterado ↑</div>
                <div class="panel-separador"></div>
                <div class="panel-linea">Esperado: <span class="v-ok">${bits4orig.join('')} = ${numOrig}</span></div>
                <div class="panel-linea">Recibido: <span class="v-err">${bitsRecibidos.join('')} = ${numRecib}</span></div>
                <div class="panel-separador"></div>
                <div class="panel-estado peligro">❌ Error no detectado.</div>
            </div>`;

    } else {
        const etq7 = ['P1','P2','D1','P4','D2','D3','D4'];
        const tablaRecibida = `<div class="bit-tabla">
            <div class="bit-tabla-fila etq">${etq7.map(e => `<span>${e}</span>`).join('')}</div>
            <div class="bit-tabla-fila">${renderBits(bitsRecibidos, posErrorBit, 'err')}</div>
        </div>`;
        const tablaCorregida = `<div class="bit-tabla">
            <div class="bit-tabla-fila etq">${etq7.map(e => `<span>${e}</span>`).join('')}</div>
            <div class="bit-tabla-fila">${renderBits(palabraCorregida, posErrorBit, 'fix')}</div>
        </div>`;
        const [s1, s2, s4]  = sindrome;
        const numRecuperado  = parseInt(bits4orig.join(''), 2);

        panel.innerHTML = `
            <div class="panel-info-titulo">📥 Recibido</div>
            <div class="panel-info-scroll">
                <div class="panel-subtitulo">7 bits recibidos:</div>
                ${tablaRecibida}
                <div class="panel-separador"></div>
                <div class="panel-subtitulo">Síndrome S4·S2·S1:</div>
                <div class="panel-sindrome-mini">${s4}&nbsp;${s2}&nbsp;${s1} <span class="v-err">→ pos&nbsp;${posErrorHamming}</span></div>
                <div class="panel-separador"></div>
                <div class="panel-subtitulo">Bit corregido:</div>
                ${tablaCorregida}
                <div class="panel-linea">Datos: <span class="v-ok">${bits4orig.join('')} = ${numRecuperado}</span></div>
                <div class="panel-separador"></div>
                <div class="panel-estado ok">✓ Mensaje íntegro.</div>
            </div>`;
    }
}

function resetearPaneles() {
    document.getElementById('panel-emisor-info').innerHTML =
        `<div class="panel-info-vacio">
            <span class="panel-vacio-icono">📤</span>
            <span class="panel-vacio-texto">Envía un mensaje para ver el proceso de codificación</span>
        </div>`;
    document.getElementById('panel-receptor-info').innerHTML =
        `<div class="panel-info-vacio">
            <span class="panel-vacio-icono">📥</span>
            <span class="panel-vacio-texto">Aquí verás el resultado al recibir el mensaje</span>
        </div>`;
}

// ----- Flujos de transmisión -----

function transmitirSinProteccion() {
    if (estadoChat.transmitiendo) return;
    const numero = obtenerNumeroValidado();
    if (numero === null) return;

    const bits4 = numeroA4Bits(numero);

    bloquearBotonesVisual(true);
    agregarBurbujaEmisora(`${numero}  →  ${bits4.join('')}`);
    mostrarPanelEmisor(numero, bits4, 'sin-proteccion', null);
    activarOndas('normal');
    mostrarIconoCanal('');

    setTimeout(() => {
        activarOndas('error');
        activarInterferencia(true);
        mostrarIconoCanal('⚡');
    }, 700);

    setTimeout(() => {
        activarInterferencia(false);
        mostrarIconoCanal('');
        activarOndas('normal');

        const { bitsConError, posicion } = introducirErrorBit(bits4);
        const numRecibido = parseInt(bitsConError.join(''), 2);
        agregarBurbujaReceptora(`${bitsConError.join('')}  →  ${numRecibido}`, 'corrompido', posicion);
        mostrarPanelReceptor(bits4, bitsConError, posicion, 'corrompido', null, null, null);

        bloquearBotonesVisual(false);
    }, 1700);
}

function transmitirConHamming() {
    if (estadoChat.transmitiendo) return;
    const numero = obtenerNumeroValidado();
    if (numero === null) return;

    const bits4        = numeroA4Bits(numero);
    const bitsParidad  = calcularBitsDeParidad(bits4);
    const palabraCodigo = construirPalabraCodigo(bits4, bitsParidad);

    bloquearBotonesVisual(true);
    agregarBurbujaEmisora(`🛡️ ${numero}  →  ${palabraCodigo.join('')}`);
    mostrarPanelEmisor(numero, bits4, 'hamming', palabraCodigo);
    activarOndas('hamming');
    mostrarIconoCanal('🛡️');

    setTimeout(() => {
        activarInterferencia(true);
        mostrarIconoCanal('⚡');
    }, 700);

    setTimeout(() => {
        activarInterferencia(false);
        mostrarIconoCanal('🛡️');
        activarOndas('hamming');
    }, 1200);

    setTimeout(() => {
        mostrarIconoCanal('');
        activarOndas('normal');

        const { bitsConError, posicion } = introducirErrorBit(palabraCodigo);
        const sindrome      = calcularSindrome(bitsConError);
        const posError      = detectarError(sindrome);
        const palabraCorregida = corregirBit(bitsConError, posError);
        const bitsRecuperados  = extraerBitsDeDatos(palabraCorregida);

        agregarBurbujaReceptora(`${bitsRecuperados.join('')}  →  ${numero}`, 'corregido', posError);
        mostrarPanelReceptor(bits4, bitsConError, posicion, 'corregido', sindrome, posError, palabraCorregida);

        bloquearBotonesVisual(false);
    }, 1900);
}

function limpiarChatVisual() {
    document.getElementById('chat-emisor').innerHTML  = '';
    document.getElementById('chat-receptor').innerHTML = '';
    mostrarIconoCanal('');
    activarOndas('normal');
    activarInterferencia(false);
    document.getElementById('visual-mensaje-error').style.display = 'none';
    resetearPaneles();
}

// =====================================================================
//  INICIALIZACIÓN Y VALIDACIÓN DE ENTRADA EN TIEMPO REAL
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    const camposBits = document.querySelectorAll('.campo-bit');

    camposBits.forEach(campo => {
        campo.addEventListener('input', () => {
            let valor = campo.value;
            // Permitir solo 0 o 1
            if (valor !== '0' && valor !== '1' && valor !== '') {
                campo.value = valor.slice(-1) === '0' ? '0' : (valor.slice(-1) === '1' ? '1' : '');
            }
            if (valor.length > 1) {
                campo.value = valor.slice(-1);
            }
        });

        campo.addEventListener('keydown', evento => {
            // Mover al siguiente campo al presionar Enter o ArrowRight
            if (evento.key === 'Enter' || evento.key === 'ArrowRight') {
                const camposArray = Array.from(camposBits);
                const indiceActual = camposArray.indexOf(campo);
                if (indiceActual < camposArray.length - 1) {
                    camposArray[indiceActual + 1].focus();
                } else {
                    document.getElementById('boton-iniciar').click();
                }
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const campoNumero = document.getElementById('entrada-numero-visual');
    if (!campoNumero) return;

    campoNumero.addEventListener('input', () => {
        const v = parseInt(campoNumero.value);
        if (isNaN(v)) { campoNumero.value = ''; return; }
        if (v < 1) campoNumero.value = '1';
        if (v > 7) campoNumero.value = '7';
    });

    campoNumero.addEventListener('keydown', evento => {
        if (evento.key === 'Enter') transmitirConHamming();
    });
});
