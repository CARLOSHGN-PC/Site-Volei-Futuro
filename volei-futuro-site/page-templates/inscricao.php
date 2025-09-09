<section id="registration-form">
    <h2>Formulário de Inscrição para Atletas</h2>
    <p>Preencha o formulário abaixo para participar de nossas seletivas. Entraremos em contato em breve com mais informações.</p>

    <form action="index.php?page=inscricao_handler" method="post">
        <label for="nome_completo">Nome Completo do Atleta:</label>
        <input type="text" id="nome_completo" name="nome_completo" required>

        <label for="data_nascimento">Data de Nascimento:</label>
        <input type="date" id="data_nascimento" name="data_nascimento" required>

        <label for="nome_responsavel">Nome do Pai/Mãe ou Responsável (para menores de 18 anos):</label>
        <input type="text" id="nome_responsavel" name="nome_responsavel">

        <label for="email_contato">Email de Contato:</label>
        <input type="email" id="email_contato" name="email_contato" required>

        <label for="telefone_contato">Telefone de Contato (com DDD):</label>
        <input type="tel" id="telefone_contato" name="telefone_contato" placeholder="(99) 99999-9999" required>

        <label for="posicao">Posição em que joga (ou gostaria de jogar):</label>
        <select id="posicao" name="posicao">
            <option value="nao_sei">Não sei / Iniciante</option>
            <option value="levantador">Levantador(a)</option>
            <option value="central">Central</option>
            <option value="ponteiro">Ponteiro(a) / Passador(a)</option>
            <option value="oposto">Oposto(a)</option>
            <option value="libero">Líbero</option>
        </select>

        <label for="experiencia_previa">Já jogou em algum outro time ou escolinha? Se sim, qual?</label>
        <textarea id="experiencia_previa" name="experiencia_previa" rows="4"></textarea>

        <button type="submit">Enviar Inscrição</button>
    </form>
</section>
