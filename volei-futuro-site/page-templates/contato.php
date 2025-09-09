<section id="contact">
    <h2>Entre em Contato</h2>
    <p>Tem alguma dúvida, sugestão ou quer apoiar nosso projeto? Fale conosco!</p>

    <div class="contact-info">
        <p><strong>Email:</strong> contato@voleifuturo.com.br</p>
        <p><strong>Telefone:</strong> (99) 99999-9999</p>
        <p><strong>Endereço do Ginásio:</strong> Rua das Quadras, 123, Bairro Esportivo, Cidade-Exemplo</p>
    </div>

    <form action="index.php?page=contato_handler" method="post">
        <label for="name">Nome:</label>
        <input type="text" id="name" name="name" required>

        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>

        <label for="subject">Assunto:</label>
        <input type="text" id="subject" name="subject" required>

        <label for="message">Mensagem:</label>
        <textarea id="message" name="message" rows="6" required></textarea>

        <button type="submit">Enviar Mensagem</button>
    </form>
</section>
