<section id="single-post-content">
    <?php
    // Simulação de um banco de dados de posts com conteúdo completo
    $posts = [
        [
            'slug' => 'vitoria-no-campeonato-regional',
            'title' => 'Vitória no Campeonato Regional!',
            'date' => '05 de Setembro, 2024',
            'content' => '<p>Nossa equipe sub-17 conquistou o título regional em um jogo emocionante contra o time da casa. A final foi decidida no tie-break, com uma virada espetacular no último set.</p><p>O técnico João Silva elogiou a resiliência da equipe: "As meninas mostraram uma força mental incrível. Mesmo quando estávamos atrás no placar, elas não desistiram e lutaram por cada ponto. É um orgulho para todos nós."</p><p>Com esta vitória, a equipe garante vaga no campeonato nacional que acontecerá em dezembro.</p>'
        ],
        [
            'slug' => 'seletiva-aberta-para-novas-atletas',
            'title' => 'Seletiva Aberta para Novas Atletas',
            'date' => '01 de Setembro, 2024',
            'content' => '<p>Estamos em busca de novos talentos para nossas equipes de base. As inscrições estão abertas até o final do mês para meninas de 14 a 18 anos. As interessadas devem preencher o formulário de inscrição em nosso site e comparecer ao ginásio no dia da seletiva com documento de identidade e atestado médico.</p><p><strong>Datas da Seletiva:</strong></p><ul><li>Sub-15: 28 de Setembro, às 14h</li><li>Sub-17: 29 de Setembro, às 14h</li></ul><p>Não perca a chance de fazer parte do Volei Futuro!</p>'
        ],
        [
            'slug' => 'novo-uniforme-do-time',
            'title' => 'Volei Futuro Lança Novo Uniforme para a Temporada',
            'date' => '25 de Agosto, 2024',
            'content' => '<p>Com um design moderno e tecnologia de ponta para absorção de suor, o novo uniforme do Volei Futuro foi apresentado em um evento especial para patrocinadores e para a comunidade.</p><p>As cores tradicionais do clube, azul e branco, foram mantidas, mas com um novo grafismo que remete à velocidade e à força do esporte. O novo material já está à venda na loja oficial do nosso site.</p>'
        ]
    ];

    $post_found = null;
    if (isset($_GET['slug'])) {
        $slug = $_GET['slug'];
        foreach ($posts as $post) {
            if ($post['slug'] === $slug) {
                $post_found = $post;
                break;
            }
        }
    }

    if ($post_found) {
        echo '<h2>' . htmlspecialchars($post_found['title']) . '</h2>';
        echo '<p class="post-meta">Publicado em ' . htmlspecialchars($post_found['date']) . '</p>';
        echo '<div class="post-content">' . $post_found['content'] . '</div>'; // O conteúdo já tem HTML, então não escapamos
        echo '<a href="index.php?page=noticias">&larr; Voltar para todas as notícias</a>';
    } else {
        echo '<h2>Post não encontrado</h2>';
        echo '<p>O artigo que você está procurando não foi encontrado. <a href="index.php?page=noticias">Voltar para as notícias</a>.</p>';
    }
    ?>
</section>
